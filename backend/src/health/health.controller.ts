import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Verifica a disponibilidade da API e do PostgreSQL',
  })
  @ApiResponse({ status: 200, description: 'API e banco disponíveis' })
  @ApiResponse({
    status: 503,
    description: 'Uma dependência está indisponível',
  })
  check() {
    return this.health.check([
      () =>
        this.indicators
          .check('database')
          .attempt(async () => {
            try {
              await this.prisma.$queryRaw`SELECT 1`;
            } catch {
              throw new Error('PostgreSQL is unavailable');
            }
          })
          .withTimeout(1000),
    ]);
  }
}
