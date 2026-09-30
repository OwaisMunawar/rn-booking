/**
 * Timezone helpers built on Intl only (no Date#getHours, no process TZ).
 *
 * A provider works in their own IANA zone. Everything in the engine is either a
 * wall-clock value in that zone ("2026-03-08", "09:30") or an absolute instant
 * (a Date / ISO string in UTC). These helpers are the only bridge between the two.
 */

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    // Some engines still emit "24" for midnight even with h23.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. -300 for EST). */
export function getOffsetMinutes(instant: Date, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / MINUTE_MS);
}

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * Converts a wall-clock time in `timeZone` to an absolute instant.
 *
 * Uses the same disambiguation as Temporal's "compatible" mode:
 * - a time inside a DST gap (e.g. 02:30 on spring-forward) moves forward by the gap
 * - an ambiguous time (e.g. 01:30 on fall-back) resolves to the earlier instant
 *
 * `minuteOfDay` may be 1440 to mean midnight at the end of `date`.
 */
export function zonedTimeToUtc(date: string, minuteOfDay: number, timeZone: string): Date {
  const { year, month, day } = parseDate(date);
  const wallMs = Date.UTC(year, month - 1, day, 0, minuteOfDay);

  // Offsets half a day either side cover any single transition near this wall time.
  const before = getOffsetMinutes(new Date(wallMs - 12 * 60 * MINUTE_MS), timeZone);
  const after = getOffsetMinutes(new Date(wallMs + 12 * 60 * MINUTE_MS), timeZone);

  const candidates = [...new Set([before, after])]
    .map((offset) => wallMs - offset * MINUTE_MS)
    .filter((utcMs) => getOffsetMinutes(new Date(utcMs), timeZone) * MINUTE_MS === wallMs - utcMs)
    .sort((a, b) => a - b);

  const earliest = candidates[0];
  if (earliest !== undefined) return new Date(earliest);

  // Gap: interpret with the offset in force before the transition, which lands after it.
  return new Date(wallMs - before * MINUTE_MS);
}

export function toLocalDate(instant: Date, timeZone: string): string {
  const p = getZonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toLocalTime(instant: Date, timeZone: string): string {
  const p = getZonedParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Day of week (0 = Sunday) of a calendar date. Independent of any timezone. */
export function weekdayOf(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-4]):([0-5]\d)$/;

export function parseDate(date: string): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** "09:30" -> 570. Accepts "24:00" as end of day. */
export function parseTime(time: string): number {
  const match = TIME_RE.exec(time);
  if (!match) throw new RangeError(`Invalid time "${time}", expected HH:mm`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > DAY_MINUTES) throw new RangeError(`Invalid time "${time}"`);
  return minutes;
}

export function formatTime(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
