'use client';

import { useActionState } from 'react';

import { FormMessage } from '@/components/form-message';
import { Button, Field, inputClass } from '@/components/ui';
import { signIn } from '@/server/actions/auth';
import { idle } from '@/server/actions/action-state';

export interface DemoAccount {
  userId: string;
  name: string;
  description: string;
}

export function LoginForm({
  mode,
  demoAccounts,
}: {
  mode: 'demo' | 'supabase';
  demoAccounts: DemoAccount[];
}) {
  const [state, action, pending] = useActionState(signIn, idle);

  if (mode === 'demo') {
    return (
      <form action={action} className="space-y-3">
        {demoAccounts.map((account) => (
          <button
            key={account.userId}
            name="userId"
            value={account.userId}
            disabled={pending}
            className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
          >
            <span className="block font-medium">Continue as {account.name}</span>
            <span className="block text-sm text-zinc-500">{account.description}</span>
          </button>
        ))}
        <FormMessage state={state} />
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
