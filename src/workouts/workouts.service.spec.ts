import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Workout } from './schemas/workout.schema';
import { WorkoutsService } from './workouts.service';

describe('WorkoutsService query filters', () => {
  let service: WorkoutsService;
  let workoutModel: {
    find: jest.Mock;
    countDocuments: jest.Mock;
  };

  beforeEach(async () => {
    const findExec = jest.fn().mockResolvedValue([]);
    const countExec = jest.fn().mockResolvedValue(0);
    const findChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: findExec,
    };

    workoutModel = {
      find: jest.fn().mockReturnValue(findChain),
      countDocuments: jest.fn().mockReturnValue({ exec: countExec }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        {
          provide: getModelToken(Workout.name),
          useValue: workoutModel,
        },
      ],
    }).compile();

    service = moduleRef.get(WorkoutsService);
  });

  it('keeps workout list queries scoped to the authenticated user', async () => {
    const userId = new Types.ObjectId().toHexString();

    await service.findAll(userId, { page: 1, limit: 10 });

    expect(workoutModel.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
    });
    expect(workoutModel.countDocuments).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
    });
  });

  it('adds safe exercise name search and exact exercise filters', async () => {
    const userId = new Types.ObjectId().toHexString();

    await service.findAll(userId, {
      page: 1,
      limit: 10,
      search: 'bench.*',
      exercise: 'Bench Press',
    });

    expect(workoutModel.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      $and: [
        {
          'exercises.name': {
            $regex: 'bench\\.\\*',
            $options: 'i',
          },
        },
        {
          'exercises.name': {
            $regex: '^Bench Press$',
            $options: 'i',
          },
        },
      ],
    });
  });

  it('adds inclusive day boundaries for from/to date filters', async () => {
    const userId = new Types.ObjectId().toHexString();

    await service.findAll(userId, {
      page: 1,
      limit: 10,
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(workoutModel.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      date: {
        $gte: new Date('2026-05-01T00:00:00.000Z'),
        $lte: new Date('2026-05-31T23:59:59.999Z'),
      },
    });
  });
});
