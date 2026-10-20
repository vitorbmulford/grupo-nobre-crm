import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const { error, value } = Joi.object({
          NODE_ENV: Joi.string()
            .valid('development', 'test', 'production')
            .default('development'),
          PORT: Joi.number().port().default(3001),
          DATABASE_URL: Joi.string()
            .uri({ scheme: ['postgres', 'postgresql'] })
            .required(),
          LOG_LEVEL: Joi.string()
            .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
            .default('info'),
          CORS_ORIGINS: Joi.string()
            .default('http://localhost:3000')
            .custom((value, helpers) => {
              const origins = value
                .split(',')
                .map((origin: string) => origin.trim());
              if (
                origins.some((origin: string) => {
                  try {
                    const parsed = new URL(origin);
                    return (
                      origin === '*' ||
                      !['http:', 'https:'].includes(parsed.protocol) ||
                      parsed.origin !== origin
                    );
                  } catch {
                    return true;
                  }
                })
              ) {
                return helpers.error('any.invalid');
              }
              return value;
            }),
        }).validate(config, { abortEarly: false, allowUnknown: true });

        if (error) {
          const invalidKeys = error.details
            .map(({ path }) => path.join('.') || 'environment')
            .join(', ');
          throw new Error(`Invalid environment configuration: ${invalidKeys}`);
        }

        return value;
      },
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          genReqId: (req, res) => {
            const candidate = req.headers['x-correlation-id'];
            const id =
              typeof candidate === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                candidate,
              )
                ? candidate
                : randomUUID();
            res.setHeader('X-Correlation-ID', id);
            return id;
          },
          customLogLevel: (_req, res) =>
            res.statusCode >= 400 && res.statusCode < 500 ? 'warn' : 'info',
          customErrorObject: (req, res, _error, fields) => ({
            correlationId: req.id,
            method: req.method,
            path: new URL(req.url ?? '/', 'http://localhost').pathname,
            statusCode: res.statusCode,
            responseTime: fields.responseTime,
          }),
          customErrorMessage: () => 'request completed',
          autoLogging: {
            ignore: (req) => req.url?.split('?')[0] === '/api/health',
          },
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: new URL(req.url ?? '/', 'http://localhost').pathname,
            }),
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers.set-cookie',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    PrismaModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
