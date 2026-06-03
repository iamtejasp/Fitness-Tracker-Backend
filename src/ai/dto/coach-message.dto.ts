import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CoachMessageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;
}
