import { Module } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [WorkoutsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
