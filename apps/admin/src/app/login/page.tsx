import { DEMO_USERS, demoProfiles, demoProviders } from '@rn-booking/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui';
import { LoginForm, type DemoAccount } from '@/features/auth/login-form';
import { dataMode } from '@/server/env';
import { getSession } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in' };

const name = (id: string) => demoProfiles.find((p) => p.id === id)?.fullName ?? 'Demo user';
const providerName =
  demoProviders.find((p) => p.userId === DEMO_USERS.provider)?.name ?? 'a provider';

const demoAccounts: DemoAccount[] = [
  {
    userId: DEMO_USERS.admin,
    name: name(DEMO_USERS.admin),
    description: 'Admin: every provider, booking and setting',
  },
  {
    userId: DEMO_USERS.provider,
    name: name(DEMO_USERS.provider),
    description: `Provider: only ${providerName}, its services, hours and bookings`,
  },
];

export default async function LoginPage() {
  if (await getSession()) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-600">rn-booking</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sign in to the admin</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {dataMode === 'demo'
              ? 'Demo mode: data is seeded in memory. Pick a role to see what it can access.'
              : 'Use an admin or provider account. Customer accounts are rejected.'}
          </p>
        </div>
        <Card>
          <LoginForm mode={dataMode} demoAccounts={demoAccounts} />
        </Card>
      </div>
    </main>
  );
}
