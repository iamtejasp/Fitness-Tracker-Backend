import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutQueryDto } from './dto/workout-query.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createWorkoutDto: CreateWorkoutDto,
  ) {
    return this.workoutsService.create(currentUser.sub, createWorkoutDto);
  }

  @Get()
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() workoutQueryDto: WorkoutQueryDto,
  ) {
    return this.workoutsService.findAll(currentUser.sub, workoutQueryDto);
  }

  @Get('last-30-days')
  getLast30Days(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.workoutsService.getLast30Days(currentUser.sub);
  }

  @Get('stats')
  getStats(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.workoutsService.getStats(currentUser.sub);
  }

  @Get(':id')
  findById(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') workoutId: string,
  ) {
    return this.workoutsService.findById(currentUser.sub, workoutId);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') workoutId: string,
    @Body() updateWorkoutDto: UpdateWorkoutDto,
  ) {
    return this.workoutsService.update(
      currentUser.sub,
      workoutId,
      updateWorkoutDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') workoutId: string,
  ) {
    return this.workoutsService.remove(currentUser.sub, workoutId);
  }
}
