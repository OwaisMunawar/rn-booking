import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BookingSupabaseClient, Database } from '@rn-booking/shared';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabaseConfig } from './config';

let client: BookingSupabaseClient | null = null;

/** Lazily created so demo mode never touches Supabase or AsyncStorage. */
export function getSupabase(): BookingSupabaseClient {
  if (!supabaseConfig) throw new Error('Supabase is not configured');
  if (client) return client;

  // Static web rendering runs without window; sessions only live in the client.
  const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';
  client = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      storage: canPersist ? AsyncStorage : undefined,
      persistSession: canPersist,
      autoRefreshToken: canPersist,
      detectSessionInUrl: false,
    },
  });

  if (Platform.OS !== 'web') {
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client?.auth.startAutoRefresh();
      else void client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
