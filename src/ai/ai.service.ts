import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoachMessageDto } from './dto/coach-message.dto';
import {
  CoachMessage,
  CoachMessageDocument,
  CoachMessageStatus,
} from './schemas/coach-message.schema';
import { WorkoutDocument } from '../workouts/schemas/workout.schema';
import { WorkoutsService } from '../workouts/workouts.service';

export interface CoachResponse {
  advice: string;
}

export interface CoachHistoryResponse {
  data: CoachHistoryMessage[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CoachHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: CoachMessageStatus;
  clientMessageId?: string;
  turnId: string;
  createdAt: Date;
  updatedAt?: Date;
}

const COACH_GENERATION_CONFIG = {
  temperature: 0.45,
  maxOutputTokens: 4096,
} as const;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly gemini: GoogleGenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly workoutsService: WorkoutsService,
    @InjectModel(CoachMessage.name)
    private readonly coachMessageModel: Model<CoachMessageDocument>,
  ) {
    this.gemini = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('gemini.apiKey'),
    });
    this.model = this.configService.get<string>(
      'gemini.model',
      'gemini-2.5-flash',
    );
  }

  async coach(
    userId: string,
    coachMessageDto: CoachMessageDto,
  ): Promise<CoachResponse> {
    const turn = await this.createOrReuseUserTurn(userId, coachMessageDto);
    const prompt = await this.buildCoachPrompt(userId, coachMessageDto.message);

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: prompt.contents,
        config: {
          systemInstruction: prompt.systemInstruction,
          ...COACH_GENERATION_CONFIG,
        },
      });

      const advice =
        response.text?.trim() ??
        'I could not generate coaching advice right now.';

      await this.saveAssistantMessage(userId, turn.turnId, advice, 'complete');

      return { advice };
    } catch (error) {
      this.logger.error('Gemini coach request failed', error);
      await this.saveAssistantMessage(
        userId,
        turn.turnId,
        this.getFriendlyAiError(),
        'error',
      );
      throw new BadGatewayException('AI coaching service is unavailable');
    }
  }

  async *streamCoach(
    userId: string,
    coachMessageDto: CoachMessageDto,
  ): AsyncGenerator<string> {
    const turn = await this.createOrReuseUserTurn(userId, coachMessageDto);
    const prompt = await this.buildCoachPrompt(userId, coachMessageDto.message);
    let assistantContent = '';

    try {
      const stream = await this.gemini.models.generateContentStream({
        model: this.model,
        contents: prompt.contents,
        config: {
          systemInstruction: prompt.systemInstruction,
          ...COACH_GENERATION_CONFIG,
        },
      });

      for await (const chunk of stream) {
        const content = chunk.text;

        if (content) {
          assistantContent += content;
          yield content;
        }
      }

      await this.saveAssistantMessage(
        userId,
        turn.turnId,
        assistantContent || 'I could not generate coaching advice right now.',
        'complete',
      );
    } catch (error) {
      this.logger.error('Gemini streaming coach request failed', error);
      await this.saveAssistantMessage(
        userId,
        turn.turnId,
        assistantContent
          ? `${assistantContent}\n\n${this.getFriendlyAiError()}`.trim()
          : this.getFriendlyAiError(),
        'error',
      );
      throw new BadGatewayException('AI coaching service is unavailable');
    }
  }

  async getCoachHistory(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<CoachHistoryResponse> {
    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const filter = { userId: new Types.ObjectId(userId) };
    const total = await this.coachMessageModel.countDocuments(filter);
    const messages = await this.coachMessageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit)
      .lean<
        Array<
          CoachMessage & {
            _id: Types.ObjectId;
            createdAt: Date;
            updatedAt?: Date;
          }
        >
      >();

    return {
      data: messages.reverse().map((message) => ({
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        status: message.status,
        clientMessageId: message.clientMessageId,
        turnId: message.turnId,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  private async buildCoachPrompt(userId: string, message: string) {
    const workouts = await this.workoutsService.getLast30Days(userId);
    const workoutSummary = this.formatWorkoutSummary(workouts);

    return {
      systemInstruction:
        'You are an expert fitness coach for a mobile fitness tracker app. ' +
        'Use the user question and workout history to give detailed, practical, personalized coaching. ' +
        'Always inspect recent exercise trends before answering. If the user asks how to improve an exercise, ' +
        'identify whether performance is progressing, stalled, or missing enough data. ' +
        'Write like a senior strength coach: specific, explanatory, and directly actionable. ' +
        'Do not give generic one-line advice, do not stop after a partial sentence, and do not answer with only a summary. ' +
        'Give concrete sets, reps, load changes, progression rules, deload guidance, technique cues, warm-up guidance, and recovery advice where relevant.',
      contents:
        `User question: ${message}\n\n` +
        `Last 30 days workout history:\n${workoutSummary}\n\n` +
        'Response requirements:\n' +
        '- Answer in a complete, detailed format of roughly 600-1000 words when the question asks for improvement, planning, plateau help, or training advice.\n' +
        '- Use these sections when relevant: Quick assessment, What your recent data suggests, Main recommendation, 4-week progression plan, Technique cues, Recovery checks, What to track next.\n' +
        '- Include at least 12 practical bullets or short paragraphs unless the user asks for a very short answer.\n' +
        '- Ground the advice in the workout history above.\n' +
        '- If a plateau is visible, explain the likely cause and exact progression strategy with week-by-week loading guidance.\n' +
        '- If the user asks about a specific lift, include warm-up sets, working sets, rep targets, progression rules, accessory exercises, and form cues.\n' +
        '- If data is missing, say what data is missing and still provide a safe starter plan.\n' +
        '- Avoid medical claims and recommend professional help for pain or injury symptoms.',
    };
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

  private async createOrReuseUserTurn(
    userId: string,
    coachMessageDto: CoachMessageDto,
  ) {
    const clientMessageId = coachMessageDto.clientMessageId?.trim();

    if (clientMessageId) {
      const existingMessage = await this.coachMessageModel.findOne({
        userId: new Types.ObjectId(userId),
        role: 'user',
        clientMessageId,
      });

      if (existingMessage) {
        return existingMessage;
      }
    }

    return this.coachMessageModel.create({
      userId: new Types.ObjectId(userId),
      role: 'user',
      content: coachMessageDto.message.trim(),
      status: 'complete',
      clientMessageId,
      turnId: clientMessageId ?? `turn-${Date.now()}`,
    });
  }

  private async saveAssistantMessage(
    userId: string,
    turnId: string,
    content: string,
    status: CoachMessageStatus,
  ) {
    const filter = {
      userId: new Types.ObjectId(userId),
      role: 'assistant' as const,
      turnId,
    };

    if (status === 'complete') {
      await this.coachMessageModel.deleteMany({ ...filter, status: 'error' });
    }

    const existingSameStatus = await this.coachMessageModel.findOne({
      ...filter,
      status,
    });

    if (existingSameStatus) {
      if (status === 'error') {
        existingSameStatus.content = content;
        return existingSameStatus.save();
      }

      return existingSameStatus;
    }

    return this.coachMessageModel.create({
      userId: new Types.ObjectId(userId),
      role: 'assistant',
      content,
      status,
      turnId,
    });
  }

  private getFriendlyAiError() {
    return 'AI coaching is unavailable right now. Try again in a moment.';
  }
}
