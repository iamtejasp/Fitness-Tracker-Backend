import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService password recovery', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      | 'findByEmail'
      | 'findByEmailForPasswordReset'
      | 'setPasswordReset'
      | 'setPasswordResetToken'
      | 'updatePasswordAndClearReset'
    >
  >;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    usersService = {
      findByEmail: jest.fn(),
      findByEmailForPasswordReset: jest.fn(),
      setPasswordReset: jest.fn(),
      setPasswordResetToken: jest.fn(),
      updatePasswordAndClearReset: jest.fn(),
    };

    authService = new AuthService(
      usersService as unknown as UsersService,
      { sign: jest.fn().mockReturnValue('jwt-token') } as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a generic forgot-password response when the email does not exist', async () => {
    usersService.findByEmailForPasswordReset.mockResolvedValue(null);

    await expect(
      authService.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account exists for this email, a reset code has been generated.',
    });
    expect(usersService.setPasswordReset).not.toHaveBeenCalled();
  });

  it('creates and stores a hashed reset OTP for an existing user', async () => {
    usersService.findByEmailForPasswordReset.mockResolvedValue({
      id: 'user-id',
    } as never);

    const response = await authService.forgotPassword({
      email: 'athlete@example.com',
    });

    expect(response.resetOtp).toMatch(/^\d{6}$/);
    expect(usersService.setPasswordReset).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({
        otpHash: expect.any(String),
        otpExpiresAt: expect.any(Date),
      }),
    );
    const [, resetInput] = usersService.setPasswordReset.mock.calls[0];
    await expect(
      bcrypt.compare(response.resetOtp!, resetInput.otpHash),
    ).resolves.toBe(true);
  });

  it('rejects expired OTP verification', async () => {
    usersService.findByEmailForPasswordReset.mockResolvedValue({
      passwordResetOtpHash: await bcrypt.hash('123456', 4),
      passwordResetOtpExpiresAt: new Date(Date.now() - 1000),
    } as never);

    await expect(
      authService.verifyResetOtp({
        email: 'athlete@example.com',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies a valid OTP and stores a hashed reset token', async () => {
    usersService.findByEmailForPasswordReset.mockResolvedValue({
      id: 'user-id',
      passwordResetOtpHash: await bcrypt.hash('123456', 4),
      passwordResetOtpExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const response = await authService.verifyResetOtp({
      email: 'athlete@example.com',
      otp: '123456',
    });

    expect(response.resetToken).toHaveLength(64);
    expect(usersService.setPasswordResetToken).toHaveBeenCalledWith(
      'user-id',
      expect.any(String),
      expect.any(Date),
    );
    const [, resetTokenHash] = usersService.setPasswordResetToken.mock.calls[0];
    await expect(
      bcrypt.compare(response.resetToken, resetTokenHash),
    ).resolves.toBe(true);
  });

  it('resets the password and clears reset fields with a valid reset token', async () => {
    const resetToken = 'a'.repeat(64);
    usersService.findByEmailForPasswordReset.mockResolvedValue({
      id: 'user-id',
      passwordResetTokenHash: await bcrypt.hash(resetToken, 4),
      passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    await expect(
      authService.resetPassword({
        email: 'athlete@example.com',
        resetToken,
        password: 'newPassword123',
      }),
    ).resolves.toEqual({ message: 'Password has been reset successfully.' });

    expect(usersService.updatePasswordAndClearReset).toHaveBeenCalledWith(
      'user-id',
      expect.any(String),
    );
  });
});
