import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureHttp } from '../src/http/configure-http.js';
import { ConfigService } from '@nestjs/config';
import { Logger, PinoLogger } from 'nestjs-pino';
import { InfrastructureTestController } from './support/infrastructure-test.controller.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const prismaService = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [InfrastructureTestController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api');
    configureHttp(app, app.get(ConfigService));
    await app.init();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.details.database.status).toBe('up');
      });
  });

  it('documents health and serves the Swagger UI under the global prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['content-security-policy']).toContain(
      "'unsafe-inline'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    const document = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(document.body.info).toMatchObject({
      title: 'Grupo Nobre CRM API',
      description: 'API REST para gestão de oportunidades comerciais B2B',
      version: '1.0.0',
    });
    expect(document.body.paths).toHaveProperty('/api/health');
  });

  it('transforms DTOs and returns sanitized structured validation errors', async () => {
    const valid = await request(app.getHttpServer())
      .post('/api/test/echo')
      .send({ amount: '4', name: 'valid' })
      .expect(201);
    expect(valid.body.amount).toBe(4);

    const invalid = await request(app.getHttpServer())
      .post('/api/test/echo?token=query-secret')
      .set('X-Correlation-ID', '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae')
      .send({ amount: 'bad', name: 'sensitive-body-value', extra: 'private' })
      .expect(400);
    expect(invalid.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      correlationId: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
      path: '/api/test/echo',
    });
    expect(invalid.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'amount' }),
        expect.objectContaining({ field: 'extra' }),
      ]),
    );
    expect(JSON.stringify(invalid.body)).not.toContain('sensitive-body-value');
    expect(JSON.stringify(invalid.body)).not.toContain('query-secret');
  });

  it('preserves HTTP statuses and hides internal error details', async () => {
    const notFound = await request(app.getHttpServer())
      .get('/api/test/not-found?token=private-query-value')
      .expect(404);
    expect(notFound.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Test resource not found',
      path: '/api/test/not-found',
    });
    expect(JSON.stringify(notFound.body)).not.toContain('private-query-value');

    const unmatched = await request(app.getHttpServer())
      .get('/api/no-such-route?token=private-query-value')
      .expect(404);
    expect(unmatched.body.path).toBe('/api/no-such-route');
    expect(JSON.stringify(unmatched.body)).not.toContain('private-query-value');

    const unavailable = await request(app.getHttpServer())
      .get('/api/test/unavailable')
      .expect(503);
    expect(unavailable.body.message).toBe('Service Unavailable');

    const diagnosticLog = vi.spyOn(PinoLogger.prototype, 'error');
    const unexpected = await request(app.getHttpServer())
      .get('/api/test/unexpected')
      .set('X-Correlation-ID', '3b944166-550e-4b6d-ab3e-54564a0686cb')
      .expect(500);
    expect(unexpected.body.message).toBe('Internal server error');
    expect(unexpected.body.correlationId).toBe(
      '3b944166-550e-4b6d-ab3e-54564a0686cb',
    );
    expect(diagnosticLog).toHaveBeenCalledTimes(1);
    const [diagnostics] = diagnosticLog.mock.calls[0] as [
      Record<string, unknown>,
      ...unknown[],
    ];
    const loggedError = diagnostics.err as Error;
    expect(diagnostics).toMatchObject({
      errorName: 'Error',
      correlationId: unexpected.body.correlationId,
      method: 'GET',
      path: '/api/test/unexpected',
      statusCode: 500,
    });
    expect(loggedError.message).toContain('Unexpected storage failure');
    expect(loggedError.message).toContain('DATABASE_URL="[REDACTED]"');
    expect(loggedError.stack).toContain('at handler');
    const serializedDiagnostics = JSON.stringify(diagnostics);
    for (const secret of [
      'db-secret',
      'auth-secret',
      'cookie-secret',
      'body-secret',
      'query-secret',
    ]) {
      expect(serializedDiagnostics).not.toContain(secret);
    }
    diagnosticLog.mockRestore();
    expect(JSON.stringify(unexpected.body)).not.toContain('stack');
    expect(unexpected.headers['x-correlation-id']).toBe(
      unexpected.body.correlationId,
    );
  });

  it('generates, validates, and isolates correlation IDs between concurrent requests', async () => {
    const generated = await request(app.getHttpServer())
      .get('/api')
      .expect(200);
    expect(generated.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const invalid = await request(app.getHttpServer())
      .get('/api')
      .set('X-Correlation-ID', 'invalid-id')
      .expect(200);
    expect(invalid.headers['x-correlation-id']).not.toBe('invalid-id');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .get('/api')
        .set('X-Correlation-ID', '7e319dca-b030-4d1a-a28a-c80beb88300a'),
      request(app.getHttpServer())
        .get('/api')
        .set('X-Correlation-ID', '7e319dca-b030-4d1a-a28a-c80beb88300b'),
    ]);
    expect(first.headers['x-correlation-id']).toBe(
      '7e319dca-b030-4d1a-a28a-c80beb88300a',
    );
    expect(second.headers['x-correlation-id']).toBe(
      '7e319dca-b030-4d1a-a28a-c80beb88300b',
    );
  });

  it('allows configured CORS origins and handles preflight without credentials', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/test/echo')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-correlation-id')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    expect(allowed.headers['access-control-allow-headers']).toContain(
      'X-Correlation-ID',
    );
    expect(allowed.headers['access-control-expose-headers']).toContain(
      'X-Correlation-ID',
    );

    const denied = await request(app.getHttpServer())
      .get('/api')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the standardized 503 response when the database is unavailable', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(
      new Error('database credentials hidden'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/health?secret=query-secret')
      .expect(503);
    expect(response.body).toMatchObject({
      statusCode: 503,
      correlationId: response.headers['x-correlation-id'],
      path: '/api/health',
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'database credentials hidden',
    );
    expect(JSON.stringify(response.body)).not.toContain('query-secret');
  });

  afterEach(async () => {
    await app.close();
  });
});
