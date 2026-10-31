import { describe, expect, it } from 'vitest';
import { getBusinessDate } from './business-day';

// Asia/Karachi is UTC+5 with no DST.
describe('getBusinessDate (Asia/Karachi, cutoff 04:00)', () => {
  it('keeps daytime sales on the same date', () => {
    expect(getBusinessDate(new Date('2026-10-31T09:00:00Z'))).toBe('2026-10-31'); // 14:00 PKT
  });

  it('assigns 00:00-03:59 local to the previous day', () => {
    expect(getBusinessDate(new Date('2026-10-30T19:00:00Z'))).toBe('2026-10-30'); // 00:00 PKT 31st
    expect(getBusinessDate(new Date('2026-10-30T22:59:00Z'))).toBe('2026-10-30'); // 03:59 PKT 31st
  });

  it('starts the new day exactly at the cutoff', () => {
    expect(getBusinessDate(new Date('2026-10-30T23:00:00Z'))).toBe('2026-10-31'); // 04:00 PKT
  });

  it('uses local date, not UTC date, late in the evening', () => {
    expect(getBusinessDate(new Date('2026-10-31T20:30:00Z'))).toBe('2026-10-31'); // 01:30 PKT 1 Nov
  });

  it('rolls back across month and year boundaries', () => {
    expect(getBusinessDate(new Date('2026-11-01T00:30:00Z'))).toBe('2026-11-01'); // 05:30 PKT
    expect(getBusinessDate(new Date('2025-12-31T19:30:00Z'))).toBe('2025-12-31'); // 00:30 PKT 1 Jan
  });
});

describe('getBusinessDate options', () => {
  it('honours a custom cutoff', () => {
    const t = new Date('2026-10-31T00:30:00Z'); // 05:30 PKT
    expect(getBusinessDate(t, 'Asia/Karachi', '06:00')).toBe('2026-10-30');
    expect(getBusinessDate(t, 'Asia/Karachi', '05:00')).toBe('2026-10-31');
  });

  it('honours the tenant timezone', () => {
    expect(getBusinessDate(new Date('2026-10-31T01:00:00Z'), 'UTC', '04:00')).toBe('2026-10-30');
  });

  it('rejects a malformed cutoff', () => {
    expect(() => getBusinessDate(new Date(), 'Asia/Karachi', '4am')).toThrow();
  });
});
