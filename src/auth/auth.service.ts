import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

export interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

export interface ForgotPasswordResponse {
  message: string;
  resetOtp?: string;
}

export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface ResetPasswordResponse {
  message: string;
}

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;
  private readonly resetOtpExpiresInMs = 10 * 60 * 1000;

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

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const message =
      'If an account exists for this email, a reset code has been generated.';
    const user = await this.usersService.findByEmailForPasswordReset(
      forgotPasswordDto.email,
    );

    if (!user) {
      return { message };
    }

    const resetOtp = this.generateResetOtp();
    const otpHash = await bcrypt.hash(resetOtp, this.passwordSaltRounds);

    await this.usersService.setPasswordReset(user.id, {
      otpHash,
      otpExpiresAt: new Date(Date.now() + this.resetOtpExpiresInMs),
    });

    return this.shouldExposeResetOtp()
      ? { message, resetOtp }
      : { message };
  }

  async verifyResetOtp(
    verifyResetOtpDto: VerifyResetOtpDto,
  ): Promise<VerifyResetOtpResponse> {
    const user = await this.usersService.findByEmailForPasswordReset(
      verifyResetOtpDto.email,
    );

    if (
      !user?.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset code is invalid or expired');
    }

    const isOtpValid = await bcrypt.compare(
      verifyResetOtpDto.otp,
      user.passwordResetOtpHash,
    );

    if (!isOtpValid) {
      throw new BadRequestException('Reset code is invalid or expired');
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(
      resetToken,
      this.passwordSaltRounds,
    );

    await this.usersService.setPasswordResetToken(
      user.id,
      resetTokenHash,
      new Date(Date.now() + this.resetOtpExpiresInMs),
    );

    return { resetToken };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    const user = await this.usersService.findByEmailForPasswordReset(
      resetPasswordDto.email,
    );

    if (
      !user?.passwordResetTokenHash ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const isResetTokenValid = await bcrypt.compare(
      resetPasswordDto.resetToken,
      user.passwordResetTokenHash,
    );

    if (!isResetTokenValid) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(
      resetPasswordDto.password,
      this.passwordSaltRounds,
    );

    await this.usersService.updatePasswordAndClearReset(user.id, passwordHash);

    return { message: 'Password has been reset successfully.' };
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

  private generateResetOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private shouldExposeResetOtp(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}
