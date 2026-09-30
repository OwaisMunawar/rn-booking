import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { toStaffSession, type StaffSession } from './authz';
import { DEMO_SESSION_COOKIE } from './constants';
import { decodeDemoSession } from './demo-cookie';
import { dataMode } from './env';
import { getRepository } from './repository';
import { createSupabaseServerClient } from './supabase';

export { DEMO_SESSION_COOKIE };

async function currentUserId(): Promise<string | null> {
  if (dataMode === 'demo') {
    return decodeDemoSession((await cookies()).get(DEMO_SESSION_COOKIE)?.value);
  }
  // getUser() revalidates the token with Supabase Auth rather than trusting the cookie.
  const { data } = await (await createSupabaseServerClient()).auth.getUser();
  return data.user?.id ?? null;
}

/** The signed-in staff member, memoised for the current request. */
export const getSession = cache(async (): Promise<StaffSession | null> => {
  const userId = await currentUserId();
  if (!userId) return null;
  const repo = await getRepository();
  const profile = await repo.getProfile(userId);
  if (!profile) return null;
  return toStaffSession(profile, await repo.listProviders({ includeInactive: true }));
});

/** Use at the top of every page and action. Redirects rather than rendering for guests. */
export async function requireSession(): Promise<StaffSession> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
