import { describe, expect, it } from 'vitest';
import {
  addPaisa,
  bpOf,
  formatPkr,
  fromPaisa,
  percentOf,
  roundToNearest,
  toPaisa,
} from './money';

describe('toPaisa / fromPaisa', () => {
  it('converts rupees to paisa without float drift', () => {
    expect(toPaisa(1250)).toBe(125000);
    expect(toPaisa(0.1 + 0.2)).toBe(30);
    expect(toPaisa(19.99)).toBe(1999);
  });

  it('converts paisa back to rupees', () => {
    expect(fromPaisa(125000)).toBe(1250);
    expect(fromPaisa(1999)).toBe(19.99);
  });

  it('rejects non-finite input', () => {
    expect(() => toPaisa(Number.NaN)).toThrow();
  });
});

describe('addPaisa', () => {
  it('sums integers', () => {
    expect(addPaisa(100, 250, 50)).toBe(400);
  });

  it('rejects non-integer amounts', () => {
    expect(() => addPaisa(100.5, 1)).toThrow();
  });
});

describe('percentOf / bpOf', () => {
  it('rounds half up', () => {
    expect(bpOf(1001, 5000)).toBe(501); // 500.5 -> 501
    expect(percentOf(1001, 50)).toBe(501);
  });

  it('handles typical tax rates', () => {
    expect(percentOf(100000, 16)).toBe(16000);
    expect(bpOf(100000, 1600)).toBe(16000);
  });

  it('returns 0 for zero rate or amount', () => {
    expect(bpOf(0, 1600)).toBe(0);
    expect(bpOf(1000, 0)).toBe(0);
  });

  it('supports negative amounts (refunds) symmetrically away from zero on .5', () => {
    expect(bpOf(-1001, 5000)).toBe(-501);
  });
});

describe('roundToNearest', () => {
  it('does nothing for step 0 (none)', () => {
    expect(roundToNearest(12345, 0)).toBe(12345);
  });

  it('rounds to nearest 1, 5, 10 PKR', () => {
    expect(roundToNearest(12349, 100)).toBe(12300);
    expect(roundToNearest(12350, 100)).toBe(12400);
    expect(roundToNearest(12700, 500)).toBe(12500);
    expect(roundToNearest(12750, 500)).toBe(13000);
    expect(roundToNearest(12500, 1000)).toBe(13000);
    expect(roundToNearest(12499, 1000)).toBe(12000);
  });
});

describe('formatPkr', () => {
  it('formats whole rupees as Rs 1,250', () => {
    expect(formatPkr(125000)).toBe('Rs 1,250');
  });

  it('keeps paisa only when present', () => {
    expect(formatPkr(125050)).toBe('Rs 1,250.50');
  });

  it('uses grouping for large and handles zero / negative', () => {
    expect(formatPkr(123456700)).toBe('Rs 1,234,567');
    expect(formatPkr(0)).toBe('Rs 0');
    expect(formatPkr(-50000)).toBe('-Rs 500');
  });
});
