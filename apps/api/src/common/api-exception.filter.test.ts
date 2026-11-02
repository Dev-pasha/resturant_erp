import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toApiError } from './api-exception.filter';

describe('toApiError', () => {
  it('maps http status to an error code', () => {
    expect(toApiError(new NotFoundException('missing'))).toEqual({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'missing' } },
    });
  });

  it('keeps explicit code and details', () => {
    const { body } = toApiError(
      new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: { a: 1 } }),
    );
    expect(body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: { a: 1 } });
  });

  it('hides unknown errors behind INTERNAL_ERROR', () => {
    const { status, body } = toApiError(new Error('db password leaked'));
    expect(status).toBe(500);
    expect(body.error.message).toBe('Internal server error');
  });
});
