import { getWorkingMinutes } from './availability';
import type { AvailabilityRuleInput, Booking, BookingStatus, Provider } from './schemas';
import { addDays, minutesBetween, toLocalDate } from './time';

/** Statuses that consumed provider time, whether or not the customer turned up. */
const OCCUPYING: readonly BookingStatus[] = ['pending', 'confirmed', 'completed', 'no_show'];

export interface DashboardInput {
  bookings: readonly Pick<Booking, 'providerId' | 'startAt' | 'endAt' | 'status' | 'priceCents'>[];
  providers: readonly Pick<Provider, 'id' | 'timeZone' | 'isActive'>[];
  rulesByProvider: ReadonlyMap<string, readonly AvailabilityRuleInput[]>;
  now: Date;
  /** Timezone used to decide what "today" means on the dashboard. */
  timeZone: string;
  chartDays?: number;
}

export interface RevenuePoint {
  date: string;
  cents: number;
}

export interface DashboardStats {
  bookingsToday: number;
  upcomingBookings: number;
  /** Completed bookings over the last 30 days, including today. */
  revenue30dCents: number;
  /** Booked minutes / working minutes today, 0..1. Null when nobody works today. */
  utilisationToday: number | null;
  revenueByDay: RevenuePoint[];
}

export function computeDashboardStats(input: DashboardInput): DashboardStats {
  const { bookings, now, timeZone } = input;
  const today = toLocalDate(now, timeZone);
  const localDate = (iso: string) => toLocalDate(new Date(iso), timeZone);
  const since30 = addDays(today, -29);
  const chartDays = input.chartDays ?? 14;
  const chartStart = addDays(today, -(chartDays - 1));

  const todays = bookings.filter((b) => localDate(b.startAt) === today);
  const bookingsToday = todays.filter((b) => b.status !== 'cancelled').length;
  const upcomingBookings = bookings.filter(
    (b) =>
      (b.status === 'confirmed' || b.status === 'pending') &&
      Date.parse(b.startAt) >= now.getTime(),
  ).length;

  const completed = bookings.filter((b) => b.status === 'completed');
  const revenue30dCents = completed
    .filter((b) => localDate(b.startAt) >= since30 && localDate(b.startAt) <= today)
    .reduce((sum, b) => sum + b.priceCents, 0);

  const byDay = new Map<string, number>();
  for (let i = 0; i < chartDays; i++) byDay.set(addDays(chartStart, i), 0);
  for (const b of completed) {
    const date = localDate(b.startAt);
    const current = byDay.get(date);
    if (current !== undefined) byDay.set(date, current + b.priceCents);
  }

  let workingMinutes = 0;
  for (const provider of input.providers) {
    if (!provider.isActive) continue;
    workingMinutes += getWorkingMinutes({
      date: toLocalDate(now, provider.timeZone),
      timeZone: provider.timeZone,
      rules: input.rulesByProvider.get(provider.id) ?? [],
    });
  }
  const activeIds = new Set(input.providers.filter((p) => p.isActive).map((p) => p.id));
  const bookedMinutes = todays
    .filter((b) => activeIds.has(b.providerId) && OCCUPYING.includes(b.status))
    .reduce((sum, b) => sum + minutesBetween(new Date(b.startAt), new Date(b.endAt)), 0);

  return {
    bookingsToday,
    upcomingBookings,
    revenue30dCents,
    utilisationToday: workingMinutes > 0 ? Math.min(1, bookedMinutes / workingMinutes) : null,
    revenueByDay: [...byDay].map(([date, cents]) => ({ date, cents })),
  };
}
