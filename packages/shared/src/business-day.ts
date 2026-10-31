export type BusinessDate = string; // YYYY-MM-DD

export const DEFAULT_TIMEZONE = 'Asia/Karachi';
export const DEFAULT_DAY_CUTOFF = '04:00';

const CUTOFF_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cutoffMinutes(cutoff: string): number {
  const match = CUTOFF_PATTERN.exec(cutoff);
  if (!match) throw new RangeError(`Invalid day cutoff "${cutoff}", expected HH:mm`);
  return Number(match[1]) * 60 + Number(match[2]);
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  minutes: number;
}

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    minutes: get('hour') * 60 + get('minute'),
  };
}

/**
 * The business day an instant belongs to. Anything before the branch's day cutoff
 * (default 04:00 local) belongs to the previous calendar day.
 */
export function getBusinessDate(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
  cutoff: string = DEFAULT_DAY_CUTOFF,
): BusinessDate {
  const local = localParts(instant, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (local.minutes < cutoffMinutes(cutoff)) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
