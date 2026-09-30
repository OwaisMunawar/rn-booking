import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Card, PageHeader } from '@/components/ui';
import { ProviderForm } from '@/features/providers/provider-form';
import { isAdmin } from '@/server/authz';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'New provider' };

export default async function NewProviderPage() {
  if (!isAdmin(await requireSession())) notFound();
  return (
    <>
      <PageHeader title="New provider" description="Add hours and services after creating it." />
      <Card>
        <ProviderForm />
      </Card>
    </>
  );
}
