import { CATEGORY_LABELS } from '@rn-booking/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, EmptyRow, PageHeader, buttonClass } from '@/components/ui';
import { getRepository } from '@/server/repository';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Providers' };

export default async function ProvidersPage() {
  const session = await requireSession();
  if (session.providerId) redirect(`/providers/${session.providerId}`);

  const repo = await getRepository();
  const [providers, services] = await Promise.all([
    repo.listProviders({ includeInactive: true }),
    repo.listServices({ includeInactive: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Providers"
        description="Businesses listed in the app"
        actions={
          <Link href="/providers/new" className={buttonClass()}>
            New provider
          </Link>
        }
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Neighbourhood</th>
              <th className="px-4 py-3 text-right font-medium">Services</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {providers.length === 0 ? <EmptyRow colSpan={5}>No providers yet.</EmptyRow> : null}
            {providers.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/providers/${p.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{CATEGORY_LABELS[p.category]}</td>
                <td className="px-4 py-3">{p.neighborhood}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {services.filter((s) => s.providerId === p.id).length}
                </td>
                <td className="px-4 py-3">{p.isActive ? 'Listed' : 'Hidden'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
