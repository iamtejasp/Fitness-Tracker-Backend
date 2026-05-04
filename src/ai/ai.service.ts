import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CoachMessageDto } from './dto/coach-message.dto';
import { WorkoutDocument } from '../workouts/schemas/workout.schema';
import { WorkoutsService } from '../workouts/workouts.service';

export interface CoachResponse {
  advice: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly workoutsService: WorkoutsService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('openai.apiKey'),
    });
    this.model = this.configService.get<string>('openai.model', 'gpt-4.1-mini');
  }

  async coach(
    userId: string,
    coachMessageDto: CoachMessageDto,
  ): Promise<CoachResponse> {
    const prompt = await this.buildCoachPrompt(userId, coachMessageDto.message);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: prompt,
        temperature: 0.4,
        max_tokens: 220,
      });

      return {
        advice:
          completion.choices[0]?.message.content?.trim() ??
          'I could not generate coaching advice right now.',
      };
    } catch (error) {
      this.logger.error('OpenAI coach request failed', error);
      throw new BadGatewayException('AI coaching service is unavailable');
    }
  }

  async *streamCoach(
    userId: string,
    coachMessageDto: CoachMessageDto,
  ): AsyncGenerator<string> {
    const prompt = await this.buildCoachPrompt(userId, coachMessageDto.message);

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: prompt,
        temperature: 0.4,
        max_tokens: 220,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;

        if (content) {
          yield content;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI streaming coach request failed', error);
      throw new BadGatewayException('AI coaching service is unavailable');
    }
  }

  private async buildCoachPrompt(userId: string, message: string) {
    const workouts = await this.workoutsService.getLast30Days(userId);
    const workoutSummary = this.formatWorkoutSummary(workouts);

    return [
      {
        role: 'system' as const,
        content:
          'You are an expert fitness coach for a mobile fitness tracker app. ' +
          'Use the workout history to detect plateaus, suggest progressive ' +
          'overload, and give actionable advice. Keep every answer concise ' +
          'and practical in 3-5 lines.',
      },
      {
        role: 'user' as const,
        content:
          `User question: ${message}\n\n` +
          `Last 30 days workout history:\n${workoutSummary}`,
      },
    ];
  }

  private formatWorkoutSummary(workouts: WorkoutDocument[]): string {
    if (workouts.length === 0) {
      return 'No workouts logged in the last 30 days.';
    }

    return workouts
      .map((workout) => {
        const date = workout.date.toISOString().slice(0, 10);
        const exercises = workout.exercises
          .map(
            (exercise) =>
              `${exercise.name}: ${exercise.weight}kg x ${exercise.reps} reps x ${exercise.sets} sets`,
          )
          .join('; ');

        return `- ${date}: ${exercises}`;
      })
      .join('\n');
  }
}
