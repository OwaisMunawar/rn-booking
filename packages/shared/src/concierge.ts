import { z } from 'zod';

import type { Slot } from './availability';
import { getSlotsForService } from './booking-service';
import { DEMO_LOCATION } from './demo-data';
import { formatClock, formatDateLabel, formatPrice, distanceKm } from './format';
import type { BookingRepository } from './repository';
import { categorySchema, type Category } from './schemas';
import { addDays, parseTime, toLocalDate, weekdayOf } from './time';

/**
 * Shared pieces of the booking concierge: the tool contracts the language model
 * calls, their implementations, and a rule-based parser. The parser powers
 * demo mode and doubles as an offline fallback, so the feature works without
 * an API key.
 */

export const NEAR_ME_RADIUS_KM = 5;

export const searchServicesInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text service keywords, e.g. "haircut" or "deep tissue massage".'),
  category: categorySchema.optional().describe('Restrict to one category.'),
  maxPriceCents: z.number().int().positive().optional().describe('Price ceiling in US cents.'),
  nearMe: z
    .boolean()
    .optional()
    .describe(`Only providers within ${NEAR_ME_RADIUS_KM} km of the user.`),
  limit: z.number().int().min(1).max(10).optional(),
});
export type SearchServicesInput = z.infer<typeof searchServicesInputSchema>;

export const getAvailabilityInputSchema = z.object({
  serviceId: z.string().describe('Service id returned by searchServices.'),
  date: z.iso.date().describe("Calendar date in the provider's timezone, YYYY-MM-DD."),
  earliest: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .describe('Earliest start, HH:mm.'),
  latest: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .describe('Latest start, HH:mm (exclusive).'),
  limit: z.number().int().min(1).max(12).optional(),
});
export type GetAvailabilityInput = z.infer<typeof getAvailabilityInputSchema>;

export interface ServiceMatch {
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  neighborhood: string;
  category: Category;
  priceCents: number;
  durationMinutes: number;
  rating: number;
  distanceKm: number;
  timeZone: string;
}

export interface ConciergeResult {
  service: ServiceMatch;
  date: string;
  slots: Slot[];
}

export interface ConciergeResponse {
  mode: 'demo' | 'live' | 'offline';
  reply: string;
  results: ConciergeResult[];
  /** What the concierge understood, shown as chips so users can see the interpretation. */
  interpretation: string[];
}

const SYNONYMS: { terms: RegExp; category: Category; keywords: string[] }[] = [
  { terms: /\bbeards?\b/, category: 'hair', keywords: ['beard'] },
  {
    terms: /\b(hair ?cuts?|cuts?|barbers?|fades?|trims?)\b/,
    category: 'hair',
    keywords: ['cut', 'fade'],
  },
  { terms: /\bblow ?(outs?|dry)\b/, category: 'hair', keywords: ['blowout'] },
  {
    terms: /\b(massages?|deep tissue|swedish)\b/,
    category: 'wellness',
    keywords: ['tissue', 'swedish'],
  },
  { terms: /\b(nails?|manicures?|gel)\b/, category: 'beauty', keywords: ['gel'] },
  { terms: /\b(pilates|reformer|workout|trainer)\b/, category: 'fitness', keywords: [] },
  { terms: /\b(clean(ing|er|ers)?|maid)\b/, category: 'home', keywords: [] },
  { terms: /\b(dogs?|cats?|pets?|groom(ing)?)\b/, category: 'pets', keywords: [] },
];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const TIME_OF_DAY = {
  morning: ['06:00', '12:00'],
  afternoon: ['12:00', '17:00'],
  evening: ['17:00', '22:00'],
} as const;

export interface ParsedQuery {
  query?: string;
  category?: Category;
  date: string;
  earliest?: string;
  latest?: string;
  maxPriceCents?: number;
  nearMe: boolean;
}

/**
 * Pulls structured intent out of requests like
 * "haircut near me Saturday afternoon under $40".
 */
export function parseConciergeQuery(text: string, now: Date, timeZone: string): ParsedQuery {
  const input = text.toLowerCase();
  const today = toLocalDate(now, timeZone);
  const parsed: ParsedQuery = {
    date: today,
    nearMe: /\b(near (me|by)|nearby|close by|walking distance)\b/.test(input),
  };

  const synonym = SYNONYMS.find((s) => s.terms.test(input));
  if (synonym) {
    parsed.category = synonym.category;
    const keyword = synonym.keywords.find((k) => input.includes(k));
    if (keyword) parsed.query = keyword;
  }

  if (/\btomorrow\b/.test(input)) {
    parsed.date = addDays(today, 1);
  } else if (/\b(this )?weekend\b/.test(input)) {
    parsed.date = nextWeekday(today, 6);
  } else {
    const index = WEEKDAYS.findIndex((day) =>
      new RegExp(`\\b${day}s?\\b|\\b${day.slice(0, 3)}\\b`).test(input),
    );
    if (index >= 0) parsed.date = nextWeekday(today, index, /\bnext\b/.test(input));
  }

  for (const [label, [start, end]] of Object.entries(TIME_OF_DAY)) {
    if (input.includes(label) || (label === 'evening' && /\btonight\b/.test(input))) {
      parsed.earliest = start;
      parsed.latest = end;
    }
  }
  const after = /\bafter (\d{1,2})(?::(\d{2}))? ?(am|pm)?/.exec(input);
  if (after) parsed.earliest = toClock(after[1], after[2], after[3]);
  const before = /\bbefore (\d{1,2})(?::(\d{2}))? ?(am|pm)?/.exec(input);
  if (before) parsed.latest = toClock(before[1], before[2], before[3]);

  const price = /\b(?:under|below|less than|max(?:imum)?|up to|<)\s*\$?(\d+(?:\.\d{1,2})?)/.exec(
    input,
  );
  if (price?.[1]) parsed.maxPriceCents = Math.round(Number(price[1]) * 100);

  return parsed;
}

function nextWeekday(from: string, weekday: number, skipThisWeek = false): string {
  let delta = (weekday - weekdayOf(from) + 7) % 7;
  if (skipThisWeek && delta < 7) delta += 7;
  return addDays(from, delta);
}

function toClock(hour?: string, minute?: string, meridiem?: string): string {
  let h = Number(hour ?? 0);
  // "after 3" in a booking context almost always means 3 PM.
  if (meridiem === 'pm' || (!meridiem && h >= 1 && h <= 7)) h = (h % 12) + 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${minute ?? '00'}`;
}

export function describeQuery(parsed: ParsedQuery): string[] {
  const chips: string[] = [];
  if (parsed.query) chips.push(parsed.query);
  else if (parsed.category) chips.push(parsed.category);
  chips.push(formatDateLabel(parsed.date));
  if (parsed.earliest || parsed.latest) {
    chips.push(
      [
        parsed.earliest ? formatClock(parsed.earliest) : 'open',
        parsed.latest ? formatClock(parsed.latest) : 'close',
      ].join(' - '),
    );
  }
  if (parsed.maxPriceCents !== undefined) chips.push(`under ${formatPrice(parsed.maxPriceCents)}`);
  if (parsed.nearMe) chips.push(`within ${NEAR_ME_RADIUS_KM} km`);
  return chips;
}

/** Tool: find bookable services. Results are ranked by distance, then rating. */
export async function searchServices(
  repo: BookingRepository,
  input: SearchServicesInput,
  origin: { lat: number; lng: number } = DEMO_LOCATION,
): Promise<ServiceMatch[]> {
  const all = await repo.listServices({
    category: input.category,
    maxPriceCents: input.maxPriceCents,
  });
  const words = (input.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return all
    .filter((s) => {
      if (words.length === 0) return true;
      const haystack = `${s.name} ${s.description}`.toLowerCase();
      return words.some((word) => haystack.includes(word.replace(/s$/, '')));
    })
    .map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      providerId: s.providerId,
      providerName: s.provider.name,
      neighborhood: s.provider.neighborhood,
      category: s.category,
      priceCents: s.priceCents,
      durationMinutes: s.durationMinutes,
      rating: s.provider.rating,
      distanceKm: distanceKm(origin, s.provider),
      timeZone: s.provider.timeZone,
    }))
    .filter((m) => !input.nearMe || m.distanceKm <= NEAR_ME_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating)
    .slice(0, input.limit ?? 5)
    .map((m) => ({ ...m, distanceKm: Math.round(m.distanceKm * 10) / 10 }));
}

/** Tool: open slots for one service on one day, optionally within a time window. */
export async function getAvailability(
  repo: BookingRepository,
  input: GetAvailabilityInput,
  now: Date = new Date(),
): Promise<Slot[]> {
  const earliest = input.earliest ? parseTime(input.earliest) : 0;
  const latest = input.latest ? parseTime(input.latest) : 24 * 60;
  const slots = await getSlotsForService(repo, input.serviceId, input.date, now);
  return slots
    .filter((slot) => {
      const minute = parseTime(slot.localTime);
      return minute >= earliest && minute < latest;
    })
    .slice(0, input.limit ?? 6);
}

export function summarise(results: ConciergeResult[], parsed: Pick<ParsedQuery, 'date'>): string {
  const withSlots = results.filter((r) => r.slots.length > 0);
  if (withSlots.length === 0) {
    return `I couldn't find open times for that on ${formatDateLabel(parsed.date, { weekday: 'long' })}. Try another day, a wider time window or a higher budget.`;
  }
  const lines = withSlots.slice(0, 3).map((r) => {
    const first = r.slots[0];
    const at = first ? ` from ${formatClock(first.localTime)}` : '';
    return `${r.service.serviceName} at ${r.service.providerName} (${formatPrice(r.service.priceCents)}, ${r.service.distanceKm} km)${at}`;
  });
  return `Here ${withSlots.length === 1 ? 'is 1 option' : `are ${withSlots.length} options`} for ${formatDateLabel(withSlots[0]?.date ?? parsed.date, { weekday: 'long' })}:\n${lines.map((l) => `- ${l}`).join('\n')}\nTap a time to book it.`;
}

/**
 * The whole concierge without a language model: parse, search, check availability.
 * Used by demo mode on the server and as the app's offline fallback.
 */
export async function runRuleBasedConcierge(
  repo: BookingRepository,
  text: string,
  now: Date,
  timeZone: string,
): Promise<ConciergeResponse> {
  const parsed = parseConciergeQuery(text, now, timeZone);
  const services = await searchServices(repo, {
    query: parsed.query,
    category: parsed.category,
    maxPriceCents: parsed.maxPriceCents,
    nearMe: parsed.nearMe,
    limit: 4,
  });
  const results = await Promise.all(
    services.map(async (service) => ({
      service,
      date: parsed.date,
      slots: await getAvailability(
        repo,
        {
          serviceId: service.serviceId,
          date: parsed.date,
          earliest: parsed.earliest,
          latest: parsed.latest,
        },
        now,
      ),
    })),
  );
  const bookable = results.filter((r) => r.slots.length > 0);
  return {
    mode: 'offline',
    reply: summarise(bookable, parsed),
    results: bookable,
    interpretation: describeQuery(parsed),
  };
}
