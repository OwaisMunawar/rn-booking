import { describe, expect, it } from 'vitest';

import {
  bookingsToBusy,
  getAvailableSlots,
  getWorkingIntervals,
  getWorkingMinutes,
  isSlotAvailable,
  type AvailabilityInput,
} from './availability';
import type { AvailabilityRuleInput } from './schemas';

// 2026-10-05 is a Monday.
const MONDAY = '2026-10-05';
const UTC = 'UTC';

const working = (weekday: number, startTime: string, endTime: string): AvailabilityRuleInput => ({
  kind: 'working',
  weekday,
  startTime,
  endTime,
});
const lunch = (weekday: number, startTime: string, endTime: string): AvailabilityRuleInput => ({
  kind: 'break',
  weekday,
  startTime,
  endTime,
});

function slots(overrides: Partial<AvailabilityInput> = {}) {
  return getAvailableSlots({
    date: MONDAY,
    timeZone: UTC,
    rules: [working(1, '09:00', '17:00')],
    durationMinutes: 60,
    stepMinutes: 60,
    ...overrides,
  });
}

const times = (list: { localTime: string }[]) => list.map((s) => s.localTime);

describe('getAvailableSlots: working hours', () => {
  it('fills a simple day with hourly slots', () => {
    expect(times(slots())).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });

  it('only offers starts where the full service fits before closing', () => {
    const result = slots({ durationMinutes: 45, stepMinutes: 30 });
    expect(result.at(-1)?.localTime).toBe('16:00');
    expect(result).toHaveLength(15);
  });

  it('returns nothing on a day without working rules', () => {
    expect(slots({ date: '2026-10-06' })).toEqual([]);
  });

  it('supports split shifts', () => {
    const result = slots({ rules: [working(1, '07:00', '09:00'), working(1, '17:00', '19:00')] });
    expect(times(result)).toEqual(['07:00', '08:00', '17:00', '18:00']);
  });

  it('merges overlapping windows without duplicating slots', () => {
    const result = slots({ rules: [working(1, '09:00', '12:00'), working(1, '11:00', '13:00')] });
    expect(times(result)).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('returns nothing when the service is longer than any window', () => {
    expect(slots({ rules: [working(1, '09:00', '10:00')], durationMinutes: 90 })).toEqual([]);
  });

  it('accepts 24:00 as the end of the day', () => {
    const result = slots({ rules: [working(1, '22:00', '24:00')] });
    expect(times(result)).toEqual(['22:00', '23:00']);
    expect(result.at(-1)?.end).toBe('2026-10-06T00:00:00.000Z');
  });

  it('anchors the grid at the window start', () => {
    const result = slots({
      rules: [working(1, '09:10', '11:00')],
      durationMinutes: 30,
      stepMinutes: 30,
    });
    expect(times(result)).toEqual(['09:10', '09:40', '10:10']);
  });
});

describe('getAvailableSlots: breaks', () => {
  it('removes slots that overlap a break', () => {
    const result = slots({ rules: [working(1, '09:00', '17:00'), lunch(1, '12:00', '13:00')] });
    expect(times(result)).not.toContain('12:00');
    expect(times(result)).toContain('11:00');
    expect(times(result)).toContain('13:00');
  });

  it('removes slots that would run into a break', () => {
    const result = slots({
      rules: [working(1, '09:00', '17:00'), lunch(1, '12:00', '12:30')],
      durationMinutes: 45,
      stepMinutes: 15,
    });
    expect(times(result)).not.toContain('11:30');
    expect(times(result)).toContain('11:15');
    expect(times(result)).toContain('12:30');
  });

  it('lets the clean-up buffer run into a break', () => {
    const result = slots({
      rules: [working(1, '09:00', '17:00'), lunch(1, '12:00', '13:00')],
      durationMinutes: 60,
      bufferMinutes: 15,
    });
    expect(times(result)).toContain('11:00');
  });
});

describe('getAvailableSlots: existing bookings and buffers', () => {
  const booking = { start: '2026-10-05T10:00:00Z', end: '2026-10-05T11:00:00Z' };

  it('blocks slots that overlap a booking', () => {
    const result = slots({ busy: [booking], stepMinutes: 30 });
    expect(times(result)).not.toContain('09:30');
    expect(times(result)).not.toContain('10:00');
    expect(times(result)).not.toContain('10:30');
  });

  it('allows back-to-back bookings when there is no buffer', () => {
    const result = slots({ busy: [booking] });
    expect(times(result)).toContain('09:00');
    expect(times(result)).toContain('11:00');
  });

  it("respects an existing booking's buffer", () => {
    // Booking ends at 11:00 but the provider is cleaning up until 11:15.
    const result = slots({
      busy: [{ start: booking.start, end: '2026-10-05T11:15:00Z' }],
      stepMinutes: 15,
    });
    expect(times(result)).not.toContain('11:00');
    expect(times(result)).toContain('11:15');
  });

  it("keeps the new service's own buffer clear of the next booking", () => {
    const result = slots({
      busy: [{ start: '2026-10-05T12:00:00Z', end: '2026-10-05T13:00:00Z' }],
      bufferMinutes: 15,
      stepMinutes: 15,
    });
    expect(times(result)).not.toContain('11:00');
    expect(times(result)).toContain('10:45');
  });

  it('lets the buffer run past closing time', () => {
    const result = slots({ bufferMinutes: 30 });
    expect(times(result)).toContain('16:00');
  });

  it('blocks slots partially overlapping a booking at either edge', () => {
    const result = slots({
      busy: [{ start: '2026-10-05T10:30:00Z', end: '2026-10-05T11:30:00Z' }],
      stepMinutes: 30,
    });
    expect(times(result)).not.toContain('10:00');
    expect(times(result)).not.toContain('11:00');
    expect(times(result)).toContain('09:30');
    expect(times(result)).toContain('11:30');
  });

  it('accepts busy intervals as Date objects', () => {
    const result = slots({
      busy: [{ start: new Date(booking.start), end: new Date(booking.end) }],
    });
    expect(times(result)).not.toContain('10:00');
  });

  it('ignores zero-length busy intervals', () => {
    const result = slots({ busy: [{ start: booking.start, end: booking.start }] });
    expect(times(result)).toContain('10:00');
  });
});

describe('bookingsToBusy', () => {
  const base = { startAt: '2026-10-05T10:00:00.000Z', endAt: '2026-10-05T11:00:00.000Z' };

  it('ignores cancelled, completed and no-show bookings', () => {
    const busy = bookingsToBusy([
      { ...base, status: 'cancelled' },
      { ...base, status: 'completed' },
      { ...base, status: 'no_show' },
    ]);
    expect(busy).toEqual([]);
  });

  it('uses the buffer end when present', () => {
    const [busy] = bookingsToBusy([
      { ...base, bufferEndAt: '2026-10-05T11:10:00.000Z', status: 'confirmed' },
    ]);
    expect(busy?.end).toBe('2026-10-05T11:10:00.000Z');
  });

  it('falls back to the booking end', () => {
    const [busy] = bookingsToBusy([{ ...base, status: 'pending' }]);
    expect(busy?.end).toBe(base.endAt);
  });
});

describe('getAvailableSlots: now and notice', () => {
  it('drops slots that already started', () => {
    const result = slots({ now: new Date('2026-10-05T11:30:00Z') });
    expect(result[0]?.localTime).toBe('12:00');
  });

  it('applies minimum notice', () => {
    const result = slots({ now: new Date('2026-10-05T11:30:00Z'), minNoticeMinutes: 60 });
    expect(result[0]?.localTime).toBe('13:00');
  });
});

describe('getAvailableSlots: timezones', () => {
  it('converts provider local time to UTC (London, summer time)', () => {
    const [first] = slots({ timeZone: 'Europe/London' });
    expect(first).toMatchObject({
      localTime: '09:00',
      start: '2026-10-05T08:00:00.000Z',
      utcOffset: '+01:00',
    });
  });

  it('handles half-hour offsets (Kolkata)', () => {
    const [first] = slots({ timeZone: 'Asia/Kolkata' });
    expect(first).toMatchObject({ start: '2026-10-05T03:30:00.000Z', utcOffset: '+05:30' });
  });

  it("uses the provider's calendar date, not UTC's", () => {
    // Monday 09:00 in Auckland is still Sunday in UTC.
    const [first] = slots({ timeZone: 'Pacific/Auckland' });
    expect(first).toMatchObject({ localDate: MONDAY, start: '2026-10-04T20:00:00.000Z' });
  });

  it('gives an ordinary working day the right hours on a DST change date', () => {
    // US clocks spring forward at 02:00 on Sunday 2026-03-08.
    const result = slots({
      date: '2026-03-08',
      timeZone: 'America/New_York',
      rules: [working(0, '09:00', '17:00')],
    });
    expect(result).toHaveLength(8);
    expect(result[0]?.start).toBe('2026-03-08T13:00:00.000Z');
  });

  it('skips wall-clock times that do not exist on spring-forward', () => {
    const result = slots({
      date: '2026-03-08',
      timeZone: 'America/New_York',
      rules: [working(0, '01:00', '05:00')],
    });
    // 01:00 to 05:00 is only three real hours today; 02:00 never happens.
    expect(times(result)).toEqual(['01:00', '03:00', '04:00']);
    expect(result.map((s) => s.utcOffset)).toEqual(['-05:00', '-04:00', '-04:00']);
  });

  it('offers the repeated hour twice on fall-back, distinguished by offset', () => {
    // US clocks fall back at 02:00 on Sunday 2026-11-01.
    const result = slots({
      date: '2026-11-01',
      timeZone: 'America/New_York',
      rules: [working(0, '00:00', '03:00')],
    });
    expect(times(result)).toEqual(['00:00', '01:00', '01:00', '02:00']);
    expect(result.map((s) => s.utcOffset)).toEqual(['-04:00', '-04:00', '-05:00', '-05:00']);
    expect(new Set(result.map((s) => s.start)).size).toBe(4);
  });

  it('keeps real durations across the fall-back transition', () => {
    const result = slots({
      date: '2026-11-01',
      timeZone: 'America/New_York',
      rules: [working(0, '00:30', '02:30')],
      durationMinutes: 90,
      stepMinutes: 30,
    });
    // The window is three real hours long, so a 90 minute service fits four times.
    expect(result).toHaveLength(4);
  });

  it('handles European DST (Berlin, last Sunday of March)', () => {
    const result = slots({
      date: '2026-03-29',
      timeZone: 'Europe/Berlin',
      rules: [working(0, '01:00', '04:00')],
    });
    expect(times(result)).toEqual(['01:00', '03:00']);
  });

  it('does not depend on the process timezone', () => {
    // vitest.config.ts pins TZ to Honolulu; results above are all zone-explicit.
    expect(new Date('2026-10-05T00:00:00Z').getTimezoneOffset()).toBe(600);
  });
});

describe('getAvailableSlots: date overrides', () => {
  it('closes the day when the override has no windows', () => {
    expect(slots({ overrides: [{ date: MONDAY, windows: [] }] })).toEqual([]);
  });

  it('replaces weekly hours with special hours', () => {
    const result = slots({
      overrides: [{ date: MONDAY, windows: [{ startTime: '12:00', endTime: '14:00' }] }],
    });
    expect(times(result)).toEqual(['12:00', '13:00']);
  });

  it('ignores overrides for other dates', () => {
    expect(slots({ overrides: [{ date: '2026-10-12', windows: [] }] })).toHaveLength(8);
  });
});

describe('getAvailableSlots: input validation', () => {
  it.each([
    [{ durationMinutes: 0 }, 'durationMinutes'],
    [{ bufferMinutes: -5 }, 'bufferMinutes'],
    [{ stepMinutes: 0 }, 'stepMinutes'],
  ])('rejects %o', (override, message) => {
    expect(() => slots(override)).toThrow(message);
  });
});

describe('isSlotAvailable', () => {
  it('accepts a start on the grid', () => {
    expect(
      isSlotAvailable(
        { date: MONDAY, timeZone: UTC, rules: [working(1, '09:00', '17:00')], durationMinutes: 60 },
        '2026-10-05T09:15:00Z',
      ),
    ).toBe(true);
  });

  it('rejects a start off the grid', () => {
    expect(
      isSlotAvailable(
        { date: MONDAY, timeZone: UTC, rules: [working(1, '09:00', '17:00')], durationMinutes: 60 },
        '2026-10-05T09:07:00Z',
      ),
    ).toBe(false);
  });

  it('rejects a start that is already booked', () => {
    const input: AvailabilityInput = {
      date: MONDAY,
      timeZone: UTC,
      rules: [working(1, '09:00', '17:00')],
      durationMinutes: 60,
      busy: [{ start: '2026-10-05T09:00:00Z', end: '2026-10-05T10:00:00Z' }],
    };
    expect(isSlotAvailable(input, '2026-10-05T09:30:00Z')).toBe(false);
  });
});

describe('working time', () => {
  const rules = [working(1, '09:00', '17:00'), lunch(1, '12:00', '13:00')];

  it('subtracts breaks from working intervals', () => {
    const intervals = getWorkingIntervals({ date: MONDAY, timeZone: UTC, rules });
    expect(intervals.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
      ['2026-10-05T09:00:00.000Z', '2026-10-05T12:00:00.000Z'],
      ['2026-10-05T13:00:00.000Z', '2026-10-05T17:00:00.000Z'],
    ]);
  });

  it('counts working minutes', () => {
    expect(getWorkingMinutes({ date: MONDAY, timeZone: UTC, rules })).toBe(7 * 60);
  });

  it('handles a break that covers the whole window', () => {
    expect(
      getWorkingMinutes({
        date: MONDAY,
        timeZone: UTC,
        rules: [working(1, '09:00', '10:00'), lunch(1, '08:00', '11:00')],
      }),
    ).toBe(0);
  });
});
