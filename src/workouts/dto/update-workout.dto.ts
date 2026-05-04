import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ExerciseDto } from './exercise.dto';

export class UpdateWorkoutDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises?: ExerciseDto[];

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;
}
