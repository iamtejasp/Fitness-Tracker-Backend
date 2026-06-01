import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WorkoutDocument = HydratedDocument<Workout>;

@Schema({ _id: false })
export class Exercise {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, min: 1, max: 100 })
  sets: number;

  @Prop({ required: true, min: 1, max: 1000 })
  reps: number;

  @Prop({ required: true, min: 0, max: 1000 })
  weight: number;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

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
export class Workout {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: [ExerciseSchema] })
  exercises: Exercise[];

  @Prop({ required: true, default: Date.now, index: true })
  date: Date;
}

export const WorkoutSchema = SchemaFactory.createForClass(Workout);

WorkoutSchema.index({ userId: 1, date: -1 });
WorkoutSchema.index({ userId: 1, 'exercises.name': 1 });
