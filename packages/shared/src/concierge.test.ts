import { describe, expect, it } from 'vitest';

import {
  describeQuery,
  getAvailability,
  parseConciergeQuery,
  runRuleBasedConcierge,
  searchServices,
  summarise,
} from './concierge';
import { DEMO_TIME_ZONE } from './demo-data';
import { MemoryBookingRepository } from './memory-repository';
import { parseTime } from './time';

// Wednesday 2026-10-07, 10:00 in Austin.
const NOW = new Date('2026-10-07T15:00:00Z');
const parse = (text: string) => parseConciergeQuery(text, NOW, DEMO_TIME_ZONE);

describe('parseConciergeQuery', () => {
  it('understands the headline example', () => {
    expect(parse('haircut near me Saturday afternoon under $40')).toEqual({
      category: 'hair',
      query: 'cut',
      date: '2026-10-10',
      earliest: '12:00',
      latest: '17:00',
      maxPriceCents: 4000,
      nearMe: true,
    });
  });

  it('defaults to today with no constraints', () => {
    expect(parse('anything open?')).toEqual({ date: '2026-10-07', nearMe: false });
  });

  it.each([
    ['tomorrow', '2026-10-08'],
    ['this weekend', '2026-10-10'],
    ['on wed', '2026-10-07'],
    ['next wednesday', '2026-10-14'],
    ['monday', '2026-10-12'],
  ])('resolves "%s"', (phrase, date) => {
    expect(parse(`massage ${phrase}`).date).toBe(date);
  });

  it('parses explicit time bounds', () => {
    expect(parse('beard trim after 3 before 6pm')).toMatchObject({
      earliest: '15:00',
      latest: '18:00',
      query: 'beard',
    });
    expect(parse('nails after 10am')).toMatchObject({ earliest: '10:00', category: 'beauty' });
    expect(parse('dog groom tonight')).toMatchObject({ earliest: '17:00', category: 'pets' });
  });

  it.each([
    ['less than 50', 5000],
    ['below $29.99', 2999],
    ['max 100', 10000],
  ])('parses price "%s"', (phrase, cents) => {
    expect(parse(`cleaning ${phrase}`).maxPriceCents).toBe(cents);
  });

  it('describes its interpretation', () => {
    expect(describeQuery(parse('haircut near me Saturday afternoon under $40'))).toEqual([
      'cut',
      'Sat, Oct 10',
      '12:00 PM - 5:00 PM',
      'under $40',
      'within 5 km',
    ]);
    expect(describeQuery(parse('pilates after 4'))).toEqual([
      'fitness',
      'Wed, Oct 7',
      '4:00 PM - close',
    ]);
  });
});

describe('concierge tools', () => {
  const repo = new MemoryBookingRepository({ now: () => NOW });

  it('searches by keyword, price and distance', async () => {
    const results = await searchServices(repo, {
      query: 'cut',
      category: 'hair',
      maxPriceCents: 4000,
      nearMe: true,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.priceCents <= 4000 && r.distanceKm <= 5)).toBe(true);
    expect(results[0]?.providerName).toBe('Fade & Co Barbers');
    expect(results.map((r) => r.providerName)).not.toContain('East Side Clippers');
  });

  it('includes farther providers when not limited to nearby', async () => {
    const results = await searchServices(repo, { query: 'haircut' });
    expect(results.map((r) => r.providerName)).toContain('East Side Clippers');
  });

  it('filters availability to a time window', async () => {
    const [service] = await searchServices(repo, { query: 'cut', category: 'hair' });
    const slots = await getAvailability(
      repo,
      {
        serviceId: service!.serviceId,
        date: '2026-10-10',
        earliest: '12:00',
        latest: '17:00',
        limit: 12,
      },
      NOW,
    );
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(parseTime(slot.localTime)).toBeGreaterThanOrEqual(12 * 60);
      expect(parseTime(slot.localTime)).toBeLessThan(17 * 60);
    }
  });

  it('runs end to end without a model', async () => {
    const response = await runRuleBasedConcierge(
      repo,
      'haircut near me Saturday afternoon under $40',
      NOW,
      DEMO_TIME_ZONE,
    );
    expect(response.mode).toBe('offline');
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((r) => r.slots.length > 0 && r.date === '2026-10-10')).toBe(true);
    expect(response.reply).toContain('Saturday');
  });

  it('explains when nothing matches', async () => {
    const response = await runRuleBasedConcierge(repo, 'massage under $5', NOW, DEMO_TIME_ZONE);
    expect(response.results).toEqual([]);
    expect(response.reply).toMatch(/couldn't find/);
  });

  it('summarises a single option', () => {
    const text = summarise(
      [
        {
          date: '2026-10-10',
          service: {
            serviceId: 's',
            serviceName: 'Haircut',
            providerId: 'p',
            providerName: 'Barber',
            neighborhood: 'Downtown',
            category: 'hair',
            priceCents: 3000,
            durationMinutes: 30,
            rating: 5,
            distanceKm: 1,
            timeZone: DEMO_TIME_ZONE,
          },
          slots: [
            {
              start: '',
              end: '',
              localDate: '2026-10-10',
              localTime: '13:00',
              utcOffset: '-05:00',
            },
          ],
        },
      ],
      { date: '2026-10-10' },
    );
    expect(text).toContain('Here is 1 option');
    expect(text).toContain('from 1:00 PM');
  });
});
