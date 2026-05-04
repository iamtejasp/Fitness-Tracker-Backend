import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

export interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.passwordSaltRounds,
    );

    const user = await this.usersService.create({
      name: registerDto.name,
      email: registerDto.email,
      password: passwordHash,
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email, true);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async getMe(
    currentUser: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(currentUser.sub);

    return this.serializeUser(user);
  }

  private buildAuthResponse(user: UserDocument): AuthResponse {
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
      }),
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: UserDocument): Record<string, unknown> {
    return user.toJSON() as unknown as Record<string, unknown>;
  }
}
