import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureHttp } from './http/configure-http.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  configureHttp(app, app.get(ConfigService));
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
await bootstrap();
