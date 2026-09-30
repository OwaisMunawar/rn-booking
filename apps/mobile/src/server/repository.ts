import {
  MemoryBookingRepository,
  SupabaseBookingRepository,
  type BookingRepository,
  type Database,
} from '@rn-booking/shared';
import { createClient } from '@supabase/supabase-js';

let cached: BookingRepository | undefined;

/**
 * Repository for API routes. With Supabase configured it uses the anon key,
 * which RLS limits to the public catalogue and busy intervals: exactly what
 * the concierge needs, and nothing about other customers.
 */
export function getServerRepository(): BookingRepository {
  if (cached) return cached;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  cached =
    url && key
      ? new SupabaseBookingRepository(
          createClient<Database>(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          }),
        )
      : new MemoryBookingRepository();
  return cached;
}
