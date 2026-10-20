import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

type ValidationDetail = { field: string; constraints: string[] };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const correlationId = request.id ?? randomFallbackId();
    const safePath =
      (request.originalUrl || request.path || '/').split('?')[0] || '/';
    const details = isValidationDetails(exception);

    response.setHeader('X-Correlation-ID', correlationId);
    if (!isHttpException) {
      const diagnosticError = sanitizeUnexpectedError(exception);
      this.logger.error(
        {
          err: diagnosticError,
          errorName: diagnosticError.name,
          correlationId,
          method: request.method,
          path: safePath,
          statusCode,
        },
        'Unhandled exception',
      );
    }

    const safeMessage = details
      ? 'Validation failed'
      : statusCode >= 500
        ? statusCode === HttpStatus.SERVICE_UNAVAILABLE
          ? 'Service Unavailable'
          : 'Internal server error'
        : getSafeHttpMessage(exception, statusCode);

    response.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message: safeMessage,
      ...(details ? { details } : {}),
      correlationId,
      timestamp: new Date().toISOString(),
      path: safePath,
    });
  }
}

function getSafeHttpMessage(exception: unknown, statusCode: number): string {
  if (!(exception instanceof HttpException)) {
    return STATUS_CODES[statusCode] ?? 'Error';
  }
  const payload = exception.getResponse();
  if (typeof payload === 'string') return removeQueryValues(payload);
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return removeQueryValues(message);
  }
  return removeQueryValues(
    exception.message || STATUS_CODES[statusCode] || 'Error',
  );
}

function removeQueryValues(message: string): string {
  return message.replace(/\?[^\s]*/g, '');
}

function sanitizeUnexpectedError(exception: unknown): Error {
  const source =
    exception instanceof Error ? exception : new Error('Non-Error exception');
  const safeName = sanitizeDiagnosticText(source.name, 120).replace(
    /[\r\n]/g,
    '',
  );
  const safeMessage = sanitizeDiagnosticText(source.message, 2_000);
  const safeError = new Error(safeMessage);
  safeError.name = safeName || 'Error';
  safeError.stack = sanitizeDiagnosticText(
    source.stack ?? `${safeError.name}: ${safeMessage}`,
    8_000,
  );
  return safeError;
}

function sanitizeDiagnosticText(value: string, maxLength: number): string {
  let sanitized = value
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^\s"'`<>]+/gi,
      '[REDACTED_CONNECTION_STRING]',
    )
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '[REDACTED_AUTH]')
    .replace(
      /\b(?:cookie|set-cookie|authorization)\s*[:=][^\r\n]*/gi,
      '[REDACTED_HEADER]',
    )
    .replace(
      /\b(payload|request[_-]?body|body)\s*[:=][^\r\n]*/gi,
      '$1=[REDACTED_PAYLOAD]',
    )
    .replace(/([?&][a-z0-9_.~-]+=)[^&#\s"'`)]+/gi, '$1[REDACTED]')
    .replace(
      /(["']?(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|database[_-]?url|connection[_-]?string)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s})]+)/gi,
      '$1"[REDACTED]"',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      '[REDACTED_JWT]',
    );

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.slice(0, maxLength)}…[truncated]`;
  }
  return sanitized;
}

function isValidationDetails(
  exception: unknown,
): ValidationDetail[] | undefined {
  if (!(exception instanceof HttpException)) return undefined;
  const payload = exception.getResponse();
  if (!payload || typeof payload !== 'object') return undefined;
  const details = (payload as { details?: unknown }).details;
  if (!Array.isArray(details)) return undefined;
  return details.filter(
    (item): item is ValidationDetail =>
      !!item &&
      typeof item === 'object' &&
      typeof item.field === 'string' &&
      Array.isArray(item.constraints) &&
      item.constraints.every(
        (constraint: unknown) => typeof constraint === 'string',
      ),
  );
}

function randomFallbackId(): string {
  return globalThis.crypto.randomUUID();
}
