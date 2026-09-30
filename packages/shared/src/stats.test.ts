import { describe, expect, it } from 'vitest';

import type { AvailabilityRuleInput } from './schemas';
import { computeDashboardStats } from './stats';

const NOW = new Date('2026-10-05T15:00:00Z'); // Monday
const provider = { id: 'p1', timeZone: 'UTC', isActive: true };
const rules: AvailabilityRuleInput[] = [
  { kind: 'working', weekday: 1, startTime: '09:00', endTime: '17:00' },
];

const booking = (
  startAt: string,
  minutes: number,
  status: 'completed' | 'confirmed' | 'cancelled' | 'no_show' | 'pending',
  priceCents = 5000,
) => ({
  providerId: 'p1',
  startAt,
  endAt: new Date(Date.parse(startAt) + minutes * 60_000).toISOString(),
  status,
  priceCents,
});

describe('computeDashboardStats', () => {
  const stats = computeDashboardStats({
    now: NOW,
    timeZone: 'UTC',
    providers: [provider, { id: 'p2', timeZone: 'UTC', isActive: false }],
    rulesByProvider: new Map([
      ['p1', rules],
      ['p2', rules],
    ]),
    bookings: [
      booking('2026-10-05T09:00:00Z', 60, 'completed'),
      booking('2026-10-05T10:00:00Z', 60, 'no_show'),
      booking('2026-10-05T16:00:00Z', 60, 'confirmed'),
      booking('2026-10-05T12:00:00Z', 60, 'cancelled'),
      booking('2026-10-06T09:00:00Z', 60, 'pending'),
      booking('2026-10-01T09:00:00Z', 60, 'completed', 2000),
      booking('2026-08-01T09:00:00Z', 60, 'completed', 99999),
    ],
  });

  it('counts non-cancelled bookings today', () => {
    expect(stats.bookingsToday).toBe(3);
  });

  it('counts upcoming active bookings', () => {
    expect(stats.upcomingBookings).toBe(2);
  });

  it('sums completed revenue over 30 days', () => {
    expect(stats.revenue30dCents).toBe(7000);
  });

  it('computes utilisation from occupied minutes over working minutes', () => {
    expect(stats.utilisationToday).toBeCloseTo(3 / 8);
  });

  it('builds a zero-filled daily revenue series', () => {
    expect(stats.revenueByDay).toHaveLength(14);
    expect(stats.revenueByDay.at(-1)).toEqual({ date: '2026-10-05', cents: 5000 });
    expect(stats.revenueByDay.find((p) => p.date === '2026-10-01')?.cents).toBe(2000);
    expect(stats.revenueByDay.find((p) => p.date === '2026-10-02')?.cents).toBe(0);
  });

  it('returns null utilisation when nobody works', () => {
    const closed = computeDashboardStats({
      now: NOW,
      timeZone: 'UTC',
      providers: [provider],
      rulesByProvider: new Map(),
      bookings: [],
    });
    expect(closed.utilisationToday).toBeNull();
  });
});
