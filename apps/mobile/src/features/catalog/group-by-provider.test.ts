import { MemoryBookingRepository } from '@rn-booking/shared';
import { describe, expect, it } from 'vitest';

import { groupByProvider } from './group-by-provider';

describe('groupByProvider', () => {
  it('returns one row per provider with the cheapest price, nearest first', async () => {
    const services = await new MemoryBookingRepository().listServices({ category: 'hair' });
    const rows = groupByProvider(services);
    expect(rows.map((r) => r.provider.name)).toEqual([
      'Fade & Co Barbers',
      'Loft Hair Studio',
      'East Side Clippers',
    ]);
    expect(rows[0]?.fromPriceCents).toBe(2000);
    expect(rows[0]?.serviceNames).toHaveLength(3);
  });
});
