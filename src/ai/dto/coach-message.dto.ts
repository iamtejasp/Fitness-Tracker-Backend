import { IsString, MaxLength, MinLength } from 'class-validator';

export class CoachMessageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message: string;
}
