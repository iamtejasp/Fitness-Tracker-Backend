import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'fitness-tracker-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
