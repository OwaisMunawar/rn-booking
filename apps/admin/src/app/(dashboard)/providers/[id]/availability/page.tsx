import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader, buttonClass } from '@/components/ui';
import { AvailabilityEditor } from '@/features/availability/availability-editor';
import { canManageProvider } from '@/server/authz';
import { getRepository } from '@/server/repository';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Weekly hours' };

export default async function AvailabilityPage({
  params,
}: PageProps<'/providers/[id]/availability'>) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageProvider(session, id)) notFound();

  const repo = await getRepository();
  const [provider, rules] = await Promise.all([
    repo.getProvider(id),
    repo.listAvailabilityRules(id),
  ]);
  if (!provider) notFound();

  return (
    <>
      <PageHeader
        title="Weekly hours"
        description={`${provider.name}, in ${provider.timeZone}. The app offers slots inside open hours and outside breaks.`}
        actions={
          <Link href={`/providers/${id}`} className={buttonClass('secondary')}>
            Back to listing
          </Link>
        }
      />
      <AvailabilityEditor
        providerId={id}
        initialRules={rules.map(({ kind, weekday, startTime, endTime }) => ({
          kind,
          weekday,
          startTime,
          endTime,
        }))}
      />
    </>
  );
}
