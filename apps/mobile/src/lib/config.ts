import type { DataMode } from '@rn-booking/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = url && anonKey ? { url, anonKey } : null;

/** Demo mode runs entirely on-device against seeded in-memory data. */
export const dataMode: DataMode = supabaseConfig ? 'supabase' : 'demo';
