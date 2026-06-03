import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkoutsModule } from '../workouts/workouts.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import {
  CoachMessage,
  CoachMessageSchema,
} from './schemas/coach-message.schema';

@Module({
  imports: [
    WorkoutsModule,
    MongooseModule.forFeature([
      { name: CoachMessage.name, schema: CoachMessageSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
