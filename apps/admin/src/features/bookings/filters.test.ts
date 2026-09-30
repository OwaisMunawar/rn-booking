import { describe, expect, it } from 'vitest';

import { bookingSearchSchema, toBookingFilter } from './filters';

const NOW = new Date('2026-10-05T12:00:00Z');

describe('booking filters', () => {
  it('defaults to upcoming bookings', () => {
    const search = bookingSearchSchema.parse({});
    expect(toBookingFilter(search, NOW)).toEqual({ from: NOW.toISOString() });
  });

  it('ignores junk in the URL instead of failing', () => {
    const search = bookingSearchSchema.parse({ status: 'bogus', when: 'later', provider: 'x' });
    expect(search).toEqual({ when: 'upcoming' });
  });

  it('filters past bookings by status and provider', () => {
    const provider = 'a0000000-0000-4000-8000-000000000001';
    const search = bookingSearchSchema.parse({ status: 'completed', when: 'past', provider });
    expect(toBookingFilter(search, NOW)).toEqual({
      status: 'completed',
      providerId: provider,
      to: NOW.toISOString(),
    });
  });
});
