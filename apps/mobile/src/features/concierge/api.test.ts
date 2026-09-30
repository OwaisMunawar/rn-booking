import { MemoryBookingRepository, type ConciergeResponse } from '@rn-booking/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/repository', () => {
  const repo = new MemoryBookingRepository();
  return { getRepository: () => repo };
});

const { askConcierge } = await import('./api');

describe('askConcierge', () => {
  it('returns the API response when the route answers', async () => {
    const body: ConciergeResponse = {
      mode: 'demo',
      reply: 'ok',
      results: [],
      interpretation: ['Today'],
    };
    const fetcher = vi.fn(async () => Response.json(body));
    await expect(askConcierge('haircut', fetcher)).resolves.toEqual(body);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/concierge',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('answers on-device when the route is unreachable', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const response = await askConcierge('haircut tomorrow', fetcher);
    expect(response.mode).toBe('offline');
  });

  it('answers on-device when the route returns something unexpected', async () => {
    const fetcher = vi.fn(async () => Response.json({ nope: true }));
    expect((await askConcierge('massage tomorrow', fetcher)).mode).toBe('offline');
  });
});
