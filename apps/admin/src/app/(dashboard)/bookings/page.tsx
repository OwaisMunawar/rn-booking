import { formatInstant, formatPrice } from '@rn-booking/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, EmptyRow, PageHeader, STATUS_LABELS, StatusBadge, cx } from '@/components/ui';
import {
  bookingSearchSchema,
  toBookingFilter,
  type BookingSearch,
} from '@/features/bookings/filters';
import { StatusForm } from '@/features/bookings/status-form';
import { isAdmin, scopeBookingFilter } from '@/server/authz';
import { getRepository } from '@/server/repository';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Bookings' };

const PAGE_SIZE = 50;

export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const session = await requireSession();
  const search = bookingSearchSchema.parse(await searchParams);
  const repo = await getRepository();
  const [bookings, providers] = await Promise.all([
    repo.listBookings(scopeBookingFilter(session, toBookingFilter(search, new Date()))),
    isAdmin(session) ? repo.listProviders({ includeInactive: true }) : Promise.resolve([]),
  ]);
  const rows = search.when === 'past' ? [...bookings].reverse() : bookings;

  const href = (patch: Partial<BookingSearch>) => {
    const next = { ...search, ...patch };
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.when !== 'upcoming') params.set('when', next.when);
    if (next.provider) params.set('provider', next.provider);
    const query = params.toString();
    return query ? `/bookings?${query}` : '/bookings';
  };

  return (
    <>
      <PageHeader title="Bookings" description={`${bookings.length} matching`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['upcoming', 'past', 'all'] as const).map((when) => (
          <FilterLink key={when} href={href({ when })} active={search.when === when}>
            {when[0]?.toUpperCase() + when.slice(1)}
          </FilterLink>
        ))}
        <span className="mx-2 h-5 w-px bg-zinc-200" />
        <FilterLink href={href({ status: undefined })} active={!search.status}>
          Any status
        </FilterLink>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <FilterLink
            key={value}
            href={href({ status: value as BookingSearch['status'] })}
            active={search.status === value}
          >
            {label}
          </FilterLink>
        ))}
      </div>

      {providers.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterLink href={href({ provider: undefined })} active={!search.provider}>
            All providers
          </FilterLink>
          {providers.map((p) => (
            <FilterLink
              key={p.id}
              href={href({ provider: p.id })}
              active={search.provider === p.id}
            >
              {p.name}
            </FilterLink>
          ))}
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>No bookings match these filters.</EmptyRow>
            ) : null}
            {rows.slice(0, PAGE_SIZE).map((b) => (
              <tr key={b.id} className="hover:bg-zinc-50/60">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatInstant(b.startAt, b.providerTimeZone)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{b.serviceName}</p>
                  <p className="text-xs text-zinc-500">{b.providerName}</p>
                </td>
                <td className="px-4 py-3">{b.customerName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrice(b.priceCents)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusForm key={`${b.id}-${b.status}`} bookingId={b.id} status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {rows.length > PAGE_SIZE ? (
        <p className="mt-3 text-sm text-zinc-500">
          Showing the first {PAGE_SIZE}. Narrow the filters to see more.
        </p>
      ) : null}
    </>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      // Filter URLs are built at runtime from validated params.
      href={href as '/bookings'}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-medium',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {children}
    </Link>
  );
}
