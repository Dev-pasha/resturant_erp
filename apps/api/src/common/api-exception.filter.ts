import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@erp/shared';
import type { Response } from 'express';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

interface ErrorPayload {
  code?: ErrorCode;
  message?: string | string[];
  details?: unknown;
}

export function toApiError(exception: unknown): { status: number; body: ApiError } {
  if (!(exception instanceof HttpException)) {
    return {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    };
  }
  const status = exception.getStatus();
  const raw = exception.getResponse();
  const payload: ErrorPayload = typeof raw === 'string' ? { message: raw } : (raw as ErrorPayload);
  const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
  return {
    status,
    body: {
      error: {
        code: payload.code ?? STATUS_CODES[status] ?? 'INTERNAL_ERROR',
        message: message ?? exception.message,
        ...(payload.details === undefined ? {} : { details: payload.details }),
      },
    },
  };
}

/** Formats every error as `{ error: { code, message, details? } }` (docs/API.md). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toApiError(exception);
    if (status >= 500) this.logger.error(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
