import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export function configureHttp(
  app: INestApplication,
  config: ConfigService,
): void {
  app.use(helmet());
  app.use(
    '/api/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );

  const allowedOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) =>
      callback(null, origin === undefined || allowedOrigins.includes(origin)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
    credentials: false,
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Validation failed',
          details: flattenValidationErrors(errors),
        }),
    }),
  );
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Grupo Nobre CRM API')
      .setDescription('API REST para gestão de oportunidades comerciais B2B')
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}

function flattenValidationErrors(errors: ValidationError[]) {
  const details: { field: string; constraints: string[] }[] = [];
  const visit = (error: ValidationError, parent = '') => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      details.push({ field, constraints: Object.values(error.constraints) });
    }
    error.children?.forEach((child) => visit(child, field));
  };
  errors.forEach((error) => visit(error));
  return details;
}
