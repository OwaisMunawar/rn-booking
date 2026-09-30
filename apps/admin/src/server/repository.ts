import 'server-only';

import {
  MemoryBookingRepository,
  SupabaseBookingRepository,
  type BookingRepository,
} from '@rn-booking/shared';
import { cache } from 'react';

import { dataMode } from './env';
import { createSupabaseServerClient } from './supabase';

// One in-memory store per server process, surviving hot reloads in development.
const globalStore = globalThis as typeof globalThis & {
  __demoRepository?: MemoryBookingRepository;
};

/** Per-request repository. Demo mode shares one seeded store across requests. */
export const getRepository = cache(async (): Promise<BookingRepository> => {
  if (dataMode === 'supabase')
    return new SupabaseBookingRepository(await createSupabaseServerClient());
  globalStore.__demoRepository ??= new MemoryBookingRepository();
  return globalStore.__demoRepository;
});
