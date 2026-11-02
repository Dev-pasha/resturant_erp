import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

  it('returns parsed data', () => {
    expect(pipe.transform({ name: 'Biryani' })).toEqual({ name: 'Biryani' });
  });

  it('throws on bad input', () => {
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
