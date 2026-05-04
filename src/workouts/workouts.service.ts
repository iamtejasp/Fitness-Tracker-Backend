import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutQueryDto } from './dto/workout-query.dto';
import { Workout, WorkoutDocument } from './schemas/workout.schema';

export interface PaginatedWorkouts {
  data: WorkoutDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WorkoutStats {
  totalWorkouts: number;
  workoutsThisWeek: number;
  mostFrequentExercise: string | null;
}

interface MostFrequentExerciseResult {
  _id: string;
  count: number;
}

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(Workout.name)
    private readonly workoutModel: Model<WorkoutDocument>,
  ) {}

  async create(
    userId: string,
    createWorkoutDto: CreateWorkoutDto,
  ): Promise<WorkoutDocument> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');

    return this.workoutModel.create({
      userId: userObjectId,
      exercises: createWorkoutDto.exercises,
      date: createWorkoutDto.date ?? new Date(),
    });
  }

  async findAll(
    userId: string,
    workoutQueryDto: WorkoutQueryDto,
  ): Promise<PaginatedWorkouts> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const page = workoutQueryDto.page;
    const limit = workoutQueryDto.limit;
    const skip = (page - 1) * limit;
    const filter = { userId: userObjectId };

    const [data, total] = await Promise.all([
      this.workoutModel
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.workoutModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(userId: string, workoutId: string): Promise<WorkoutDocument> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const workoutObjectId = this.toObjectId(workoutId, 'Invalid workout ID');
    const workout = await this.workoutModel
      .findOne({ _id: workoutObjectId, userId: userObjectId })
      .exec();

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return workout;
  }

  async update(
    userId: string,
    workoutId: string,
    updateWorkoutDto: UpdateWorkoutDto,
  ): Promise<WorkoutDocument> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const workoutObjectId = this.toObjectId(workoutId, 'Invalid workout ID');
    const workout = await this.workoutModel
      .findOneAndUpdate(
        { _id: workoutObjectId, userId: userObjectId },
        updateWorkoutDto,
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return workout;
  }

  async remove(userId: string, workoutId: string): Promise<void> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const workoutObjectId = this.toObjectId(workoutId, 'Invalid workout ID');
    const result = await this.workoutModel
      .deleteOne({ _id: workoutObjectId, userId: userObjectId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Workout not found');
    }
  }

  async getLast30Days(userId: string): Promise<WorkoutDocument[]> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    return this.workoutModel
      .find({ userId: userObjectId, date: { $gte: startDate } })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async getStats(userId: string): Promise<WorkoutStats> {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    const weekStart = this.getWeekStart();
    const [totalWorkouts, workoutsThisWeek, mostFrequentExercise] =
      await Promise.all([
        this.workoutModel.countDocuments({ userId: userObjectId }).exec(),
        this.workoutModel
          .countDocuments({ userId: userObjectId, date: { $gte: weekStart } })
          .exec(),
        this.getMostFrequentExercise(userObjectId),
      ]);

    return {
      totalWorkouts,
      workoutsThisWeek,
      mostFrequentExercise,
    };
  }

  private async getMostFrequentExercise(
    userId: Types.ObjectId,
  ): Promise<string | null> {
    const [result] = await this.workoutModel
      .aggregate<MostFrequentExerciseResult>([
        { $match: { userId } },
        { $unwind: '$exercises' },
        {
          $group: {
            _id: '$exercises.name',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 1 },
      ])
      .exec();

    return result?._id ?? null;
  }

  private getWeekStart(): Date {
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;

    weekStart.setDate(weekStart.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);

    return weekStart;
  }

  private toObjectId(value: string, errorMessage: string): Types.ObjectId {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(errorMessage);
    }

    return new Types.ObjectId(value);
  }
}
