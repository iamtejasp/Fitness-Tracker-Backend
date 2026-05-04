import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  sets: number;

  @IsNumber()
  @Min(1)
  @Max(1000)
  reps: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  weight: number;
}
