'use server';

import { DEMO_USERS, SupabaseBookingRepository, type BookingRepository } from '@rn-booking/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { toStaffSession } from '../authz';
import { encodeDemoSession } from '../demo-cookie';
import { dataMode } from '../env';
import { getRepository } from '../repository';
import { DEMO_SESSION_COOKIE } from '../session';
import { createSupabaseServerClient } from '../supabase';
import type { ActionResult } from './result';

const credentialsSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(6, 'Password is too short'),
});
const demoSchema = z.object({ userId: z.enum([DEMO_USERS.admin, DEMO_USERS.provider]) });

const failure = (message: string): ActionResult => ({ status: 'error', message });

export async function signIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let userId: string;
  let repo: BookingRepository;

  if (dataMode === 'demo') {
    const parsed = demoSchema.safeParse({ userId: form.get('userId') });
    if (!parsed.success) return failure('Pick one of the demo accounts.');
    userId = parsed.data.userId;
    repo = await getRepository();
  } else {
    const parsed = credentialsSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? 'Check your details.');
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return failure('Invalid email or password.');
    userId = data.user.id;
    repo = new SupabaseBookingRepository(supabase);
  }

  const profile = await repo.getProfile(userId);
  const session = profile
    ? toStaffSession(profile, await repo.listProviders({ includeInactive: true }))
    : null;
  if (!session) {
    await clearSession();
    return failure('This account is not an admin or a provider.');
  }

  if (dataMode === 'demo') {
    (await cookies()).set(DEMO_SESSION_COOKIE, encodeDemoSession(userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }
  redirect('/');
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect('/login');
}

async function clearSession() {
  if (dataMode === 'demo') {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
  } else {
    await (await createSupabaseServerClient()).auth.signOut();
  }
}
