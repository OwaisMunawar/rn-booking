import 'server-only';

import { DEMO_TIME_ZONE, type DataMode } from '@rn-booking/shared';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnv = url && anonKey ? { url, anonKey } : null;
export const dataMode: DataMode = supabaseEnv ? 'supabase' : 'demo';

/** Timezone that defines "today" on the dashboard. */
export const marketplaceTimeZone = process.env.MARKETPLACE_TIME_ZONE ?? DEMO_TIME_ZONE;
