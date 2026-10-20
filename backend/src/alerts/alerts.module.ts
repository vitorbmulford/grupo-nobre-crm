import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';
import { FollowUpSchedulerService } from './follow-up-scheduler.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsService, FollowUpSchedulerService],
})
export class AlertsModule {}
