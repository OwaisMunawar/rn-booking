import { DEMO_TIME_ZONE, runRuleBasedConcierge, type ConciergeResponse } from '@rn-booking/shared';
import { z } from 'zod';

import { getRepository } from '@/lib/repository';

const slotSchema = z.object({
  start: z.string(),
  end: z.string(),
  localTime: z.string(),
  localDate: z.string(),
  utcOffset: z.string(),
});

const responseSchema = z.object({
  mode: z.enum(['demo', 'live', 'offline']),
  reply: z.string(),
  interpretation: z.array(z.string()),
  results: z.array(
    z.object({
      date: z.string(),
      slots: z.array(slotSchema),
      service: z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        providerId: z.string(),
        providerName: z.string(),
        neighborhood: z.string(),
        category: z.enum(['hair', 'beauty', 'wellness', 'fitness', 'home', 'pets']),
        priceCents: z.number(),
        durationMinutes: z.number(),
        rating: z.number(),
        distanceKm: z.number(),
        timeZone: z.string(),
      }),
    }),
  ),
}) satisfies z.ZodType<ConciergeResponse>;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Asks the concierge API route. If the route is unreachable (static hosting,
 * no dev server) it answers on-device with the rule-based concierge instead,
 * so the screen always works.
 */
export async function askConcierge(
  message: string,
  fetcher: Fetch = fetch,
): Promise<ConciergeResponse> {
  try {
    const response = await fetcher('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error(`Concierge responded ${response.status}`);
    return responseSchema.parse(await response.json());
  } catch {
    return runRuleBasedConcierge(getRepository(), message, new Date(), DEMO_TIME_ZONE);
  }
}
