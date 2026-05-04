import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AiService } from './ai.service';
import { CoachMessageDto } from './dto/coach-message.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('coach')
  coach(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() coachMessageDto: CoachMessageDto,
  ) {
    return this.aiService.coach(currentUser.sub, coachMessageDto);
  }

  @Post('coach/stream')
  async streamCoach(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() coachMessageDto: CoachMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    try {
      for await (const chunk of this.aiService.streamCoach(
        currentUser.sub,
        coachMessageDto,
      )) {
        response.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      response.write('event: done\ndata: [DONE]\n\n');
      response.end();
    } catch {
      response.write(
        `event: error\ndata: ${JSON.stringify({
          message: 'AI coaching service is unavailable',
        })}\n\n`,
      );
      response.end();
    }
  }
}
