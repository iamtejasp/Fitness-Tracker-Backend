import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CoachMessageDocument = HydratedDocument<CoachMessage>;
export type CoachMessageRole = 'user' | 'assistant';
export type CoachMessageStatus = 'complete' | 'error';

@Schema({
  timestamps: { createdAt: true, updatedAt: true },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class CoachMessage {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant'], index: true })
  role: CoachMessageRole;

  @Prop({ required: true, trim: true, maxlength: 8000 })
  content: string;

  @Prop({ required: true, enum: ['complete', 'error'], default: 'complete' })
  status: CoachMessageStatus;

  @Prop({ trim: true, maxlength: 120, index: true })
  clientMessageId?: string;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  turnId: string;
}

export const CoachMessageSchema = SchemaFactory.createForClass(CoachMessage);

CoachMessageSchema.index({ userId: 1, createdAt: -1 });
CoachMessageSchema.index({ userId: 1, clientMessageId: 1, role: 1 });
CoachMessageSchema.index({ userId: 1, turnId: 1, role: 1 });
