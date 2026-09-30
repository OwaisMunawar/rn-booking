import {
  MemoryBookingRepository,
  SupabaseBookingRepository,
  type BookingRepository,
} from '@rn-booking/shared';

import { dataMode } from './config';
import { getSupabase } from './supabase';

let repository: BookingRepository | null = null;

export function getRepository(): BookingRepository {
  repository ??=
    dataMode === 'supabase'
      ? new SupabaseBookingRepository(getSupabase())
      : new MemoryBookingRepository();
  return repository;
}
