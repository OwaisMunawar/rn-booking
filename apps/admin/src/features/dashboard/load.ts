import 'server-only';

import { computeDashboardStats, toLocalDate, type Provider } from '@rn-booking/shared';

import { scopeBookingFilter, type StaffSession } from '@/server/authz';
import { marketplaceTimeZone } from '@/server/env';
import { getRepository } from '@/server/repository';

const DAY = 86_400_000;

export async function loadDashboard(session: StaffSession, now = new Date()) {
  const repo = await getRepository();
  const providers: Provider[] = session.providerId
    ? [await repo.getProvider(session.providerId)].filter((p): p is Provider => p !== null)
    : await repo.listProviders({ includeInactive: true });

  const [bookings, rules] = await Promise.all([
    repo.listBookings(
      scopeBookingFilter(session, {
        from: new Date(now.getTime() - 31 * DAY).toISOString(),
        to: new Date(now.getTime() + 15 * DAY).toISOString(),
      }),
    ),
    Promise.all(
      providers.map(async (p) => [p.id, await repo.listAvailabilityRules(p.id)] as const),
    ),
  ]);

  const stats = computeDashboardStats({
    bookings,
    providers,
    rulesByProvider: new Map(rules),
    now,
    timeZone: marketplaceTimeZone,
  });

  const today = toLocalDate(now, marketplaceTimeZone);
  const todays = bookings.filter(
    (b) =>
      toLocalDate(new Date(b.startAt), marketplaceTimeZone) === today && b.status !== 'cancelled',
  );

  return { stats, todays, providerCount: providers.filter((p) => p.isActive).length };
}
