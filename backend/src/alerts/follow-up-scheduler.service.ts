import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { AlertsService } from './alerts.service.js';

const INTERVAL_NAME = 'follow-up-risk-evaluation';

@Injectable()
export class FollowUpSchedulerService implements OnModuleInit {
  private running = false;

  constructor(
    private readonly alerts: AlertsService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get<number>(
      'FOLLOW_UP_EVALUATION_INTERVAL_MS',
      900000,
    );
    const interval = setInterval(() => void this.run(), intervalMs);
    interval.unref?.();
    this.schedulerRegistry.addInterval(INTERVAL_NAME, interval);
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.alerts.evaluate(new Date());
    } catch (error) {
      this.logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
        'Follow-up alert evaluation failed',
      );
    } finally {
      this.running = false;
    }
  }
}
