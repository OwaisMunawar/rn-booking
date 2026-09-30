import { describe, expect, it } from 'vitest';

import {
  addDays,
  formatOffset,
  formatTime,
  getOffsetMinutes,
  isValidTimeZone,
  parseDate,
  parseTime,
  toLocalDate,
  toLocalTime,
  weekdayOf,
  zonedTimeToUtc,
} from './time';

describe('zonedTimeToUtc', () => {
  it('converts an ordinary wall time', () => {
    expect(zonedTimeToUtc('2026-07-01', 9 * 60, 'America/Chicago').toISOString()).toBe(
      '2026-07-01T14:00:00.000Z',
    );
  });

  it('moves a time inside a spring-forward gap forward', () => {
    // 02:30 does not exist in New York on 2026-03-08; it becomes 03:30 EDT.
    expect(zonedTimeToUtc('2026-03-08', 150, 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    );
  });

  it('resolves an ambiguous fall-back time to the earlier instant', () => {
    expect(zonedTimeToUtc('2026-11-01', 90, 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('treats minute 1440 as the following midnight', () => {
    expect(zonedTimeToUtc('2026-07-01', 1440, 'UTC').toISOString()).toBe(
      '2026-07-02T00:00:00.000Z',
    );
  });
});

describe('offsets and local formatting', () => {
  it('reads offsets on both sides of a transition', () => {
    expect(getOffsetMinutes(new Date('2026-03-08T06:59:00Z'), 'America/New_York')).toBe(-300);
    expect(getOffsetMinutes(new Date('2026-03-08T07:00:00Z'), 'America/New_York')).toBe(-240);
  });

  it('formats offsets', () => {
    expect(formatOffset(-300)).toBe('-05:00');
    expect(formatOffset(330)).toBe('+05:30');
    expect(formatOffset(0)).toBe('+00:00');
  });

  it('formats local dates and times', () => {
    const instant = new Date('2026-10-04T23:30:00Z');
    expect(toLocalDate(instant, 'Europe/Paris')).toBe('2026-10-05');
    expect(toLocalTime(instant, 'Europe/Paris')).toBe('01:30');
    expect(toLocalTime(new Date('2026-10-05T00:00:00Z'), 'UTC')).toBe('00:00');
  });
});

describe('calendar helpers', () => {
  it('computes weekdays and adds days across month and year ends', () => {
    expect(weekdayOf('2026-10-05')).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('parses and formats times', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('24:00')).toBe(1440);
    expect(formatTime(570)).toBe('09:30');
    expect(() => parseTime('24:30')).toThrow(RangeError);
    expect(() => parseTime('9am')).toThrow(RangeError);
  });

  it('rejects malformed dates', () => {
    expect(() => parseDate('05/10/2026')).toThrow(RangeError);
  });

  it('validates IANA zones', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
