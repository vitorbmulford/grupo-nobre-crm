import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  const errorLogger = vi.fn();
  const logger = { error: errorLogger } as unknown as PinoLogger;
  const filter = new ApiExceptionFilter(logger);

  beforeEach(() => errorLogger.mockClear());

  function hostFor(requestOverrides: Record<string, unknown> = {}) {
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const request = {
      id: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
      method: 'GET',
      path: '/missing',
      originalUrl: '/api/missing?token=private',
      ...requestOverrides,
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    return { host, request, response };
  }

  it('formats known HTTP and validation exceptions without query values', () => {
    const { host, response } = hostFor();
    filter.catch(
      new BadRequestException({
        message: 'Validation failed',
        details: [{ field: 'name', constraints: ['name should not be empty'] }],
      }),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: [{ field: 'name', constraints: ['name should not be empty'] }],
        path: '/api/missing',
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'private',
    );
  });

  it('preserves 404 status and removes query strings from Nest messages', () => {
    const { host, response } = hostFor();
    filter.catch(
      new NotFoundException('Cannot GET /api/missing?token=private'),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Cannot GET /api/missing',
        path: '/api/missing',
      }),
    );
  });

  it('returns a generic 500 and logs a sanitized diagnostic error once', () => {
    const { host, response } = hostFor();
    filter.catch(
      new Error(
        'Database operation failed DATABASE_URL=postgresql://user:db-secret@host/db token=token-secret',
      ),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      }),
    );
    const responseBody = JSON.stringify(response.json.mock.calls[0][0]);
    expect(responseBody).not.toContain('db-secret');
    expect(responseBody).not.toContain('token-secret');
    expect(responseBody).not.toContain('stack');
    expect(errorLogger).toHaveBeenCalledTimes(1);
    const [diagnostics, logMessage] = errorLogger.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    const loggedError = diagnostics.err as Error;
    expect(logMessage).toBe('Unhandled exception');
    expect(diagnostics).toMatchObject({
      errorName: 'Error',
      correlationId: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
      method: 'GET',
      path: '/api/missing',
      statusCode: 500,
    });
    expect(loggedError).toBeInstanceOf(Error);
    expect(loggedError.message).toContain('Database operation failed');
    expect(loggedError.stack).toContain('api-exception.filter.spec.ts');
    const diagnosticText = `${loggedError.message}\n${loggedError.stack}`;
    for (const secret of ['db-secret', 'token-secret']) {
      expect(diagnosticText).not.toContain(secret);
    }
  });
});
