import { formatInstant, formatPrice } from '@rn-booking/shared';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, PageHeader, StatusBadge } from '@/components/ui';
import { KpiCard } from '@/features/dashboard/kpi-card';
import { loadDashboard } from '@/features/dashboard/load';
import { RevenueChart } from '@/features/dashboard/revenue-chart';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage() {
  const session = await requireSession();
  const { stats, todays, providerCount } = await loadDashboard(session);
  const utilisation =
    stats.utilisationToday === null ? 'Closed' : `${Math.round(stats.utilisationToday * 100)}%`;

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          session.role === 'admin'
            ? `${providerCount} active providers`
            : 'Your listing at a glance'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Bookings today"
          value={String(stats.bookingsToday)}
          hint="Excludes cancellations"
        />
        <KpiCard
          label="Revenue, 30 days"
          value={formatPrice(stats.revenue30dCents)}
          hint="Completed bookings"
        />
        <KpiCard label="Utilisation today" value={utilisation} hint="Booked time / working time" />
        <KpiCard
          label="Upcoming"
          value={String(stats.upcomingBookings)}
          hint="Confirmed and pending"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="self-start xl:col-span-3">
          <h2 className="mb-4 font-medium">Revenue, last 14 days</h2>
          <RevenueChart points={stats.revenueByDay} />
        </Card>
        <Card className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Today</h2>
            <Link href="/bookings" className="text-sm text-brand-600 hover:underline">
              All bookings
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {todays.length === 0 ? (
              <li className="py-6 text-sm text-zinc-500">Nothing booked today.</li>
            ) : null}
            {todays.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.serviceName}</p>
                  <p className="truncate text-zinc-500">
                    {formatInstant(b.startAt, b.providerTimeZone)} · {b.customerName}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
