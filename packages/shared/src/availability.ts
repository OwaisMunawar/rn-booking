import type { AvailabilityRuleInput, BookingStatus } from './schemas';
import { ACTIVE_BOOKING_STATUSES } from './schemas';
import {
  addMinutes,
  formatOffset,
  getOffsetMinutes,
  minutesBetween,
  parseTime,
  toLocalDate,
  toLocalTime,
  weekdayOf,
  zonedTimeToUtc,
} from './time';

/**
 * Slot availability engine.
 *
 * Inputs are the provider's weekly rules (in their own timezone), any existing
 * bookings, and the service being booked. Output is a list of bookable start
 * times as absolute instants, labelled with the provider's local time.
 *
 * Rules of the game:
 * - Intervals are half-open [start, end), so back-to-back bookings never collide.
 * - A service occupies [start, start + duration) and must sit inside working hours
 *   and outside breaks.
 * - Its clean-up buffer extends that to start + duration + buffer. The buffer may
 *   run past closing time or into a break, but never into another booking.
 * - Existing bookings block until their own buffer end.
 * - Candidate starts are laid on a grid anchored at each working window's start.
 * - All stepping happens in real elapsed minutes, so DST days get the right number
 *   of slots and never produce a start time that does not exist on the wall clock.
 */

export interface TimeWindow {
  startTime: string;
  endTime: string;
}

export interface DateOverride {
  /** Local calendar date in the provider's timezone. */
  date: string;
  /** Replaces the weekly working hours and breaks for that date. Empty means closed. */
  windows: TimeWindow[];
}

export interface BusyInterval {
  start: Date | string;
  end: Date | string;
}

export interface AvailabilityInput {
  /** Local calendar date in the provider's timezone (YYYY-MM-DD). */
  date: string;
  timeZone: string;
  rules: readonly AvailabilityRuleInput[];
  overrides?: readonly DateOverride[];
  busy?: readonly BusyInterval[];
  durationMinutes: number;
  bufferMinutes?: number;
  /** Grid spacing between candidate start times. Defaults to 15. */
  stepMinutes?: number;
  /** Slots starting before now + minNoticeMinutes are dropped. */
  now?: Date;
  minNoticeMinutes?: number;
}

export interface Slot {
  start: string;
  end: string;
  /** Provider-local wall time, e.g. "14:30". */
  localTime: string;
  localDate: string;
  /** Provider's UTC offset at the slot start, e.g. "-05:00". Disambiguates DST repeats. */
  utcOffset: string;
}

interface Interval {
  start: number;
  end: number;
}

export function getAvailableSlots(input: AvailabilityInput): Slot[] {
  const duration = input.durationMinutes;
  const buffer = input.bufferMinutes ?? 0;
  const step = input.stepMinutes ?? 15;
  if (duration <= 0) throw new RangeError('durationMinutes must be positive');
  if (buffer < 0) throw new RangeError('bufferMinutes cannot be negative');
  if (step <= 0) throw new RangeError('stepMinutes must be positive');

  const { working, breaks } = resolveDay(input);
  if (working.length === 0) return [];

  const busy = input.busy?.map(toInterval).filter((i) => i.end > i.start) ?? [];
  const earliest = input.now
    ? input.now.getTime() + (input.minNoticeMinutes ?? 0) * 60_000
    : Number.NEGATIVE_INFINITY;

  const durationMs = duration * 60_000;
  const blockMs = (duration + buffer) * 60_000;
  const stepMs = step * 60_000;
  const slots: Slot[] = [];

  // Windows are merged, so they are disjoint and cannot produce duplicate starts.
  for (const window of working) {
    for (let start = window.start; start + durationMs <= window.end; start += stepMs) {
      if (start < earliest) continue;
      const service: Interval = { start, end: start + durationMs };
      const blocked: Interval = { start, end: start + blockMs };
      if (breaks.some((b) => overlaps(service, b))) continue;
      if (busy.some((b) => overlaps(blocked, b))) continue;
      slots.push(toSlot(start, durationMs, input.timeZone));
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Checks a specific start time against the same rules. Used to re-validate a
 * booking request on the server instead of trusting the client's slot list.
 */
export function isSlotAvailable(input: AvailabilityInput, startAt: Date | string): boolean {
  const target = new Date(startAt).getTime();
  return getAvailableSlots(input).some((slot) => new Date(slot.start).getTime() === target);
}

/** Working intervals for a date after removing breaks, as absolute instants. */
export function getWorkingIntervals(
  input: Pick<AvailabilityInput, 'date' | 'timeZone' | 'rules' | 'overrides'>,
): { start: Date; end: Date }[] {
  const { working, breaks } = resolveDay(input);
  return subtract(working, breaks).map((i) => ({ start: new Date(i.start), end: new Date(i.end) }));
}

export function getWorkingMinutes(
  input: Pick<AvailabilityInput, 'date' | 'timeZone' | 'rules' | 'overrides'>,
): number {
  return getWorkingIntervals(input).reduce((sum, i) => sum + minutesBetween(i.start, i.end), 0);
}

export interface BookingLike {
  startAt: string;
  endAt: string;
  bufferEndAt?: string | null;
  status: BookingStatus;
}

/** Only pending and confirmed bookings hold time; each blocks until its buffer ends. */
export function bookingsToBusy(bookings: readonly BookingLike[]): BusyInterval[] {
  return bookings
    .filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status))
    .map((b) => ({ start: b.startAt, end: b.bufferEndAt ?? b.endAt }));
}

function resolveDay(input: Pick<AvailabilityInput, 'date' | 'timeZone' | 'rules' | 'overrides'>): {
  working: Interval[];
  breaks: Interval[];
} {
  const override = input.overrides?.find((o) => o.date === input.date);
  if (override) {
    return { working: merge(override.windows.map((w) => toDayInterval(input, w))), breaks: [] };
  }

  const weekday = weekdayOf(input.date);
  const today = input.rules.filter((r) => r.weekday === weekday);
  return {
    working: merge(today.filter((r) => r.kind === 'working').map((r) => toDayInterval(input, r))),
    breaks: merge(today.filter((r) => r.kind === 'break').map((r) => toDayInterval(input, r))),
  };
}

function toDayInterval(input: { date: string; timeZone: string }, window: TimeWindow): Interval {
  return {
    start: zonedTimeToUtc(input.date, parseTime(window.startTime), input.timeZone).getTime(),
    end: zonedTimeToUtc(input.date, parseTime(window.endTime), input.timeZone).getTime(),
  };
}

function toInterval(busy: BusyInterval): Interval {
  return { start: new Date(busy.start).getTime(), end: new Date(busy.end).getTime() };
}

function toSlot(startMs: number, durationMs: number, timeZone: string): Slot {
  const start = new Date(startMs);
  return {
    start: start.toISOString(),
    end: addMinutes(start, durationMs / 60_000).toISOString(),
    localTime: toLocalTime(start, timeZone),
    localDate: toLocalDate(start, timeZone),
    utcOffset: formatOffset(getOffsetMinutes(start, timeZone)),
  };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function subtract(from: Interval[], remove: Interval[]): Interval[] {
  let result = from.map((i) => ({ ...i }));
  for (const cut of remove) {
    result = result.flatMap((i) => {
      if (!overlaps(i, cut)) return [i];
      const pieces: Interval[] = [];
      if (cut.start > i.start) pieces.push({ start: i.start, end: cut.start });
      if (cut.end < i.end) pieces.push({ start: cut.end, end: i.end });
      return pieces;
    });
  }
  return result;
}
