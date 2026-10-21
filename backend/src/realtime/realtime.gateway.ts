import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RealtimeEventName, RealtimeEventPayload } from './realtime-events.js';

@WebSocketGateway({
  path: '/api/socket.io',
  cors: {
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins().includes(origin)),
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly config: ConfigService) {}

  handleConnection(client: Socket): void {
    const origin = client.handshake.headers.origin;
    const allowed = this.config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((value) => value.trim());
    if (origin && !allowed.includes(origin)) {
      client.disconnect(true);
      return;
    }
    this.logger.log('Realtime client connected');
  }

  handleDisconnect(): void {
    this.logger.log('Realtime client disconnected');
  }

  publish(event: RealtimeEventName, payload: RealtimeEventPayload): void {
    this.server.emit(event, payload);
  }
}

function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost,http://localhost:3000')
    .split(',')
    .map((value) => value.trim());
}
