import { bookingStatusSchema, type BookingFilter } from '@rn-booking/shared';
import { z } from 'zod';

export const bookingSearchSchema = z.object({
  status: bookingStatusSchema.optional().catch(undefined),
  when: z.enum(['upcoming', 'past', 'all']).catch('upcoming'),
  provider: z.uuid().optional().catch(undefined),
});

export type BookingSearch = z.infer<typeof bookingSearchSchema>;

/** Turns URL search params into a repository filter. Unknown values fall back to defaults. */
export function toBookingFilter(search: BookingSearch, now: Date): BookingFilter {
  const iso = now.toISOString();
  return {
    status: search.status,
    providerId: search.provider,
    from: search.when === 'upcoming' ? iso : undefined,
    to: search.when === 'past' ? iso : undefined,
  };
}
