import 'server-only';

import type { BookingSupabaseClient, Database } from '@rn-booking/shared';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseEnv } from './env';

/**
 * A Supabase client bound to the signed-in user's cookies, created per request.
 * Every query runs as that user, so Postgres RLS is the final authority.
 */
export async function createSupabaseServerClient(): Promise<BookingSupabaseClient> {
  if (!supabaseEnv) throw new Error('Supabase is not configured');
  const store = await cookies();
  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
