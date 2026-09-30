import { getAvailableSlots } from './availability';
import type {
  AvailabilityRule,
  AvailabilityRuleInput,
  Booking,
  BookingStatus,
  Profile,
  Provider,
  Service,
} from './schemas';
import { addDays, addMinutes, toLocalDate } from './time';

/**
 * Demo catalogue. The same providers, services, rules and users are inserted by
 * supabase/seed.sql, so demo mode and a seeded local Supabase look identical.
 * Bookings are generated relative to "now" so the dashboard always has a today.
 */

export const DEMO_TIME_ZONE = 'America/Chicago';

/** Downtown Austin. Used as "near me" until the app asks for device location. */
export const DEMO_LOCATION = { lat: 30.2672, lng: -97.7431, label: 'Downtown Austin' } as const;

const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const DEMO_USERS = {
  admin: id('c', 1),
  provider: id('c', 2),
  customer: id('c', 10),
} as const;

export const demoProfiles: Profile[] = [
  { id: DEMO_USERS.admin, fullName: 'Morgan Lee', email: 'admin@example.com', role: 'admin' },
  {
    id: DEMO_USERS.provider,
    fullName: 'Marcus Hale',
    email: 'provider@example.com',
    role: 'provider',
  },
  { id: id('c', 3), fullName: 'Priya Shah', email: 'priya@example.com', role: 'provider' },
  {
    id: DEMO_USERS.customer,
    fullName: 'Alex Rivera',
    email: 'customer@example.com',
    role: 'customer',
  },
  { id: id('c', 11), fullName: 'Jordan Kim', email: 'jordan@example.com', role: 'customer' },
  { id: id('c', 12), fullName: 'Sam Patel', email: 'sam@example.com', role: 'customer' },
  { id: id('c', 13), fullName: 'Taylor Brooks', email: 'taylor@example.com', role: 'customer' },
  { id: id('c', 14), fullName: 'Casey Nguyen', email: 'casey@example.com', role: 'customer' },
];

const provider = (n: number, fields: Omit<Provider, 'id' | 'timeZone' | 'isActive'>): Provider => ({
  id: id('a', n),
  timeZone: DEMO_TIME_ZONE,
  isActive: true,
  ...fields,
});

export const demoProviders: Provider[] = [
  provider(1, {
    userId: DEMO_USERS.provider,
    name: 'Fade & Co Barbers',
    category: 'hair',
    bio: 'Classic cuts, skin fades and hot-towel shaves. Walk-ins welcome, bookings preferred.',
    neighborhood: 'Downtown',
    address: '410 Congress Ave',
    lat: 30.2669,
    lng: -97.7428,
    rating: 4.8,
    reviewCount: 212,
  }),
  provider(2, {
    userId: id('c', 3),
    name: 'Loft Hair Studio',
    category: 'hair',
    bio: 'Colour, cuts and styling in a bright second-floor studio.',
    neighborhood: 'South Congress',
    address: '1500 S Congress Ave',
    lat: 30.2489,
    lng: -97.7497,
    rating: 4.7,
    reviewCount: 158,
  }),
  provider(3, {
    userId: null,
    name: 'East Side Clippers',
    category: 'hair',
    bio: 'No-fuss neighbourhood barber with late opening on Fridays.',
    neighborhood: 'Mueller',
    address: '1801 Aldrich St',
    lat: 30.2988,
    lng: -97.7057,
    rating: 4.5,
    reviewCount: 87,
  }),
  provider(4, {
    userId: null,
    name: 'Still Water Massage',
    category: 'wellness',
    bio: 'Licensed therapists offering Swedish, deep tissue and prenatal massage.',
    neighborhood: 'Clarksville',
    address: '1204 W Lynn St',
    lat: 30.2805,
    lng: -97.7616,
    rating: 4.9,
    reviewCount: 301,
  }),
  provider(5, {
    userId: null,
    name: 'Polished Nail Bar',
    category: 'beauty',
    bio: 'Non-toxic polishes, gel and nail art.',
    neighborhood: 'Rainey Street',
    address: '72 Rainey St',
    lat: 30.2585,
    lng: -97.7385,
    rating: 4.6,
    reviewCount: 143,
  }),
  provider(6, {
    userId: null,
    name: 'Core Form Pilates',
    category: 'fitness',
    bio: 'Reformer and mat sessions, one-to-one with certified instructors.',
    neighborhood: 'Zilker',
    address: '2201 Barton Springs Rd',
    lat: 30.2644,
    lng: -97.7689,
    rating: 4.8,
    reviewCount: 96,
  }),
  provider(7, {
    userId: null,
    name: 'Brightside Home Cleaning',
    category: 'home',
    bio: 'Insured two-person teams. Supplies included.',
    neighborhood: 'Hyde Park',
    address: '4300 Speedway',
    lat: 30.3051,
    lng: -97.7302,
    rating: 4.4,
    reviewCount: 64,
  }),
  provider(8, {
    userId: null,
    name: 'Happy Paws Grooming',
    category: 'pets',
    bio: 'Gentle grooming for dogs and cats of every size.',
    neighborhood: 'Bouldin Creek',
    address: '901 W Mary St',
    lat: 30.2473,
    lng: -97.7593,
    rating: 4.7,
    reviewCount: 119,
  }),
];

type ServiceSeed = [
  n: number,
  provider: number,
  name: string,
  minutes: number,
  buffer: number,
  dollars: number,
  description: string,
];

const serviceSeeds: ServiceSeed[] = [
  [1, 1, "Men's haircut", 30, 10, 35, 'Consultation, cut, wash and style.'],
  [2, 1, 'Beard trim', 20, 5, 20, 'Shape-up with hot towel finish.'],
  [3, 1, 'Haircut + beard', 50, 10, 50, 'The full works.'],
  [4, 2, "Women's cut & style", 60, 15, 65, 'Wash, cut and blow-dry.'],
  [5, 2, 'Blowout', 45, 10, 45, 'Wash and bouncy blow-dry.'],
  [6, 2, 'Kids haircut', 30, 10, 25, 'Under 12s.'],
  [7, 3, 'Haircut', 30, 5, 28, 'Clipper or scissor cut.'],
  [8, 3, 'Skin fade', 45, 5, 38, 'Foil-shaver finish.'],
  [9, 4, 'Swedish massage (60 min)', 60, 15, 90, 'Relaxing full-body massage.'],
  [10, 4, 'Deep tissue (90 min)', 90, 15, 130, 'Focused work on problem areas.'],
  [11, 5, 'Classic manicure', 45, 10, 30, 'Shape, cuticle care and polish.'],
  [12, 5, 'Gel manicure', 60, 10, 45, 'Long-wear gel polish.'],
  [13, 6, 'Private reformer session', 55, 5, 75, 'One-to-one reformer class.'],
  [14, 7, 'Standard clean (2 hrs)', 120, 30, 120, 'Up to two bedrooms.'],
  [15, 8, 'Bath & brush', 60, 15, 40, 'Bath, blow-dry, brush and nail trim.'],
  [16, 8, 'Full groom', 90, 15, 70, 'Bath & brush plus breed-specific cut.'],
];

export const demoServices: Service[] = serviceSeeds.map(
  ([n, p, name, minutes, buffer, dollars, description]) => {
    const owner = demoProviders[p - 1];
    if (!owner) throw new Error(`Seed service ${n} references missing provider ${p}`);
    return {
      id: id('b', n),
      providerId: owner.id,
      name,
      description,
      category: owner.category,
      durationMinutes: minutes,
      bufferMinutes: buffer,
      priceCents: dollars * 100,
      isActive: true,
    };
  },
);

const week = (
  days: number[],
  start: string,
  end: string,
  lunch?: [string, string],
): AvailabilityRuleInput[] =>
  days.flatMap((weekday) => [
    { kind: 'working' as const, weekday, startTime: start, endTime: end },
    ...(lunch ? [{ kind: 'break' as const, weekday, startTime: lunch[0], endTime: lunch[1] }] : []),
  ]);

const ruleSeeds: Record<number, AvailabilityRuleInput[]> = {
  1: week([1, 2, 3, 4, 5, 6], '09:00', '19:00', ['13:00', '13:30']),
  2: week([2, 3, 4, 5, 6], '10:00', '18:00', ['13:00', '14:00']),
  3: [
    ...week([1, 2, 3, 4], '10:00', '18:00'),
    ...week([5], '10:00', '21:00'),
    ...week([6], '09:00', '15:00'),
  ],
  4: week([1, 2, 3, 4, 5, 6, 0], '10:00', '20:00', ['14:00', '14:30']),
  5: week([1, 2, 3, 4, 5, 6], '10:00', '19:00'),
  6: [
    ...week([1, 2, 3, 4, 5], '07:00', '11:00'),
    ...week([1, 2, 3, 4, 5], '16:00', '20:00'),
    ...week([6], '08:00', '12:00'),
  ],
  7: week([1, 2, 3, 4, 5], '08:00', '17:00'),
  8: week([2, 3, 4, 5, 6], '09:00', '17:00', ['12:30', '13:00']),
};

export const demoRules: AvailabilityRule[] = demoProviders.flatMap((p, index) =>
  (ruleSeeds[index + 1] ?? []).map((rule, i) => ({
    ...rule,
    id: id('e', (index + 1) * 100 + i),
    providerId: p.id,
  })),
);

export interface DemoData {
  profiles: Profile[];
  providers: Provider[];
  services: Service[];
  rules: AvailabilityRule[];
  bookings: Booking[];
}

/** Deterministic PRNG so demo bookings are stable for a given day. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAST_DAYS = 21;
const FUTURE_DAYS = 10;

export function createDemoData(now: Date = new Date()): DemoData {
  const today = toLocalDate(now, DEMO_TIME_ZONE);
  const random = mulberry32(Number(today.replaceAll('-', '')));
  const customers = demoProfiles.filter((p) => p.role === 'customer');
  const bookings: Booking[] = [];
  let counter = 1;

  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const date = addDays(today, offset);
    for (const prov of demoProviders) {
      const services = demoServices.filter((s) => s.providerId === prov.id);
      const rules = demoRules.filter((r) => r.providerId === prov.id);
      const target = 1 + Math.floor(random() * 4);
      // Opening hours never cross midnight, so only same-day bookings can clash.
      const sameDay: Booking[] = [];

      for (let attempt = 0; attempt < target * 3 && sameDay.length < target; attempt++) {
        const service = services[Math.floor(random() * services.length)];
        if (!service) break;
        const slots = getAvailableSlots({
          date,
          timeZone: prov.timeZone,
          rules,
          // Every generated booking holds its time, whatever its status, so output
          // depends only on the date and not on the time of day it was generated.
          busy: sameDay.map((b) => ({ start: b.startAt, end: b.bufferEndAt })),
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          stepMinutes: 30,
        });
        const slot = slots[Math.floor(random() * slots.length)];
        if (!slot) break;

        const start = new Date(slot.start);
        const customer = customers[Math.floor(random() * customers.length)] ?? customers[0];
        if (!customer) break;
        const booking: Booking = {
          id: id('d', counter++),
          customerId: customer.id,
          providerId: prov.id,
          serviceId: service.id,
          startAt: slot.start,
          endAt: slot.end,
          bufferEndAt: addMinutes(
            start,
            service.durationMinutes + service.bufferMinutes,
          ).toISOString(),
          status: pickStatus(start, now, random),
          priceCents: service.priceCents,
          notes: null,
          createdAt: addMinutes(start, -60 * 24 * 3).toISOString(),
        };
        sameDay.push(booking);
        bookings.push(booking);
      }
    }
  }

  return {
    profiles: cloneAll(demoProfiles),
    providers: cloneAll(demoProviders),
    services: cloneAll(demoServices),
    rules: cloneAll(demoRules),
    bookings,
  };
}

function pickStatus(start: Date, now: Date, random: () => number): BookingStatus {
  const roll = random();
  if (start.getTime() < now.getTime()) {
    if (roll < 0.86) return 'completed';
    if (roll < 0.94) return 'cancelled';
    return 'no_show';
  }
  if (roll < 0.75) return 'confirmed';
  if (roll < 0.92) return 'pending';
  return 'cancelled';
}

function cloneAll<T extends object>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}
