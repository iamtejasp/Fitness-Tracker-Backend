import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workout, WorkoutSchema } from './schemas/workout.schema';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workout.name, schema: WorkoutSchema }]),
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
