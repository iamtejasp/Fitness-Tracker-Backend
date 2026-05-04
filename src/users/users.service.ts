import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserInput: CreateUserInput): Promise<UserDocument> {
    try {
      const user = await this.userModel.create({
        ...createUserInput,
        email: this.normalizeEmail(createUserInput.email),
      });

      return user;
    } catch (error) {
      this.handleDuplicateEmail(error);
      throw error;
    }
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: this.normalizeEmail(email) });

    if (includePassword) {
      query.select('+password');
    }

    return query.exec();
  }

  async findById(userId: string): Promise<UserDocument> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserDocument> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('User not found');
    }

    const update: UpdateProfileDto = {
      ...updateProfileDto,
      email: updateProfileDto.email
        ? this.normalizeEmail(updateProfileDto.email)
        : undefined,
    };

    try {
      const user = await this.userModel
        .findByIdAndUpdate(userId, update, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      this.handleDuplicateEmail(error);
      throw error;
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private handleDuplicateEmail(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException('Email is already in use');
    }
  }
}
