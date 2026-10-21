import { Injectable, Logger } from '@nestjs/common';
import { RealtimeEventName, RealtimeEventPayload } from './realtime-events.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  publish(event: RealtimeEventName, payload: RealtimeEventPayload): void {
    try {
      this.gateway.publish(event, payload);
    } catch {
      this.logger.warn(`Realtime event ${event} could not be published`);
    }
  }
}
