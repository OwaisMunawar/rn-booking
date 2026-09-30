import { beforeEach, describe, expect, it } from 'vitest';

import { bookSlot, getSlotsForService, upcomingDates } from './booking-service';
import {
  createDemoData,
  DEMO_TIME_ZONE,
  DEMO_USERS,
  demoProviders,
  demoServices,
} from './demo-data';
import { DomainError } from './errors';
import { MemoryBookingRepository, randomId } from './memory-repository';

const NOW = new Date('2026-10-07T15:00:00Z');
const FADE = demoProviders[0]!;
const HAIRCUT = demoServices[0]!;

function emptyRepo() {
  const data = createDemoData(NOW);
  data.bookings = [];
  return new MemoryBookingRepository({ data, now: () => NOW });
}

describe('demo data', () => {
  it('generates bookings that never overlap per provider', () => {
    const { bookings } = createDemoData(NOW);
    expect(bookings.length).toBeGreaterThan(100);
    for (const provider of demoProviders) {
      const active = bookings
        .filter(
          (b) =>
            b.providerId === provider.id && (b.status === 'confirmed' || b.status === 'pending'),
        )
        .sort((a, b) => a.startAt.localeCompare(b.startAt));
      for (let i = 1; i < active.length; i++) {
        expect(Date.parse(active[i]!.startAt)).toBeGreaterThanOrEqual(
          Date.parse(active[i - 1]!.bufferEndAt),
        );
      }
    }
  });

  it('is deterministic for a given day', () => {
    const slotsOf = (now: Date) =>
      createDemoData(now).bookings.map((b) => `${b.serviceId}@${b.startAt}`);
    expect(slotsOf(NOW)).toEqual(slotsOf(new Date('2026-10-07T20:00:00Z')));
  });

  it('uses past statuses for past bookings', () => {
    const past = createDemoData(NOW).bookings.filter((b) => Date.parse(b.startAt) < NOW.getTime());
    expect(past.every((b) => ['completed', 'cancelled', 'no_show'].includes(b.status))).toBe(true);
  });
});

describe('MemoryBookingRepository', () => {
  let repo: MemoryBookingRepository;
  beforeEach(() => {
    repo = emptyRepo();
  });

  it('lists and filters services', async () => {
    expect(await repo.listServices({ category: 'wellness' })).toHaveLength(2);
    expect(await repo.listServices({ query: 'beard' })).toHaveLength(2);
    expect(await repo.listServices({ providerId: FADE.id, maxPriceCents: 3000 })).toHaveLength(1);
  });

  it('hides inactive providers from the catalogue', async () => {
    await repo.saveProvider({ ...FADE, isActive: false });
    expect((await repo.listProviders()).map((p) => p.id)).not.toContain(FADE.id);
    expect((await repo.listProviders({ includeInactive: true })).map((p) => p.id)).toContain(
      FADE.id,
    );
    expect(await repo.listServices({ providerId: FADE.id })).toEqual([]);
  });

  it('creates providers and services', async () => {
    const created = await repo.saveProvider({
      ...FADE,
      id: undefined,
      name: 'New Barber',
      userId: null,
    });
    expect(created.rating).toBe(0);
    const service = await repo.saveService({ ...HAIRCUT, id: undefined, providerId: created.id });
    expect(service.provider.name).toBe('New Barber');
    await expect(
      repo.saveService({ ...HAIRCUT, id: undefined, providerId: randomId() }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates input with the shared schemas', async () => {
    await expect(repo.saveService({ ...HAIRCUT, durationMinutes: 0 })).rejects.toThrow();
    await expect(
      repo.replaceAvailabilityRules(FADE.id, [
        { kind: 'working', weekday: 1, startTime: '17:00', endTime: '09:00' },
      ]),
    ).rejects.toThrow('End time must be after start time');
  });

  it('replaces availability rules', async () => {
    const rules = await repo.replaceAvailabilityRules(FADE.id, [
      { kind: 'working', weekday: 6, startTime: '10:00', endTime: '12:00' },
    ]);
    expect(rules).toHaveLength(1);
    expect(await repo.listAvailabilityRules(FADE.id)).toHaveLength(1);
  });

  it('prevents overlapping bookings, buffers included', async () => {
    const first = await repo.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt: '2026-10-08T15:00:00.000Z',
    });
    expect(first.bufferEndAt).toBe('2026-10-08T15:40:00.000Z');
    await expect(
      repo.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt: '2026-10-08T15:30:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'slot_unavailable' });
    // Back-to-back after the buffer is fine.
    await expect(
      repo.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt: '2026-10-08T15:40:00.000Z',
      }),
    ).resolves.toBeDefined();
  });

  it('frees the slot when a booking is cancelled', async () => {
    const booking = await repo.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt: '2026-10-08T15:00:00.000Z',
    });
    await repo.updateBookingStatus(booking.id, 'cancelled');
    await expect(
      repo.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt: '2026-10-08T15:00:00.000Z',
      }),
    ).resolves.toBeDefined();
    await expect(repo.updateBookingStatus(randomId(), 'cancelled')).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('lists bookings with names and filters', async () => {
    await repo.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt: '2026-10-08T15:00:00.000Z',
    });
    const [view] = await repo.listBookings({
      customerId: DEMO_USERS.customer,
      from: '2026-10-08T00:00:00Z',
      to: '2026-10-09T00:00:00Z',
    });
    expect(view).toMatchObject({
      customerName: 'Alex Rivera',
      providerName: FADE.name,
      serviceName: HAIRCUT.name,
    });
    expect(await repo.listBookings({ status: 'pending' })).toEqual([]);
    expect((await repo.getBooking(view!.id))?.serviceName).toBe(HAIRCUT.name);
    expect(await repo.getBooking(randomId())).toBeNull();
  });

  it('restricts deletes that would orphan bookings', async () => {
    await repo.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt: '2026-10-08T15:00:00.000Z',
    });
    await expect(repo.deleteService(HAIRCUT.id)).rejects.toMatchObject({ code: 'conflict' });
    await expect(repo.deleteProvider(FADE.id)).rejects.toMatchObject({ code: 'conflict' });
    await repo.deleteService(demoServices[1]!.id);
    expect(await repo.getService(demoServices[1]!.id)).toBeNull();
  });

  it('deletes a provider with its services and rules', async () => {
    const loft = demoProviders[1]!;
    await repo.deleteProvider(loft.id);
    expect(await repo.getProvider(loft.id)).toBeNull();
    expect(await repo.listServices({ providerId: loft.id, includeInactive: true })).toEqual([]);
    expect(await repo.listAvailabilityRules(loft.id)).toEqual([]);
  });

  it('returns profiles', async () => {
    expect((await repo.getProfile(DEMO_USERS.admin))?.role).toBe('admin');
    expect(await repo.getProfile(randomId())).toBeNull();
  });

  it('generates valid v4 ids', () => {
    expect(randomId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('booking service', () => {
  it('lists slots honouring minimum notice', async () => {
    const repo = emptyRepo();
    const slots = await getSlotsForService(repo, HAIRCUT.id, '2026-10-07', NOW);
    // It is 10:00 in Austin; 30 minutes notice puts the first slot at 10:30.
    expect(slots[0]?.localTime).toBe('10:30');
  });

  it('books a valid slot and then refuses it', async () => {
    const repo = emptyRepo();
    const [slot] = await getSlotsForService(repo, HAIRCUT.id, '2026-10-08', NOW);
    const request = {
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt: slot!.start,
    };
    await bookSlot(repo, request, NOW);
    await expect(bookSlot(repo, request, NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
  });

  it('refuses times outside opening hours', async () => {
    const repo = emptyRepo();
    await expect(
      bookSlot(
        repo,
        {
          customerId: DEMO_USERS.customer,
          serviceId: HAIRCUT.id,
          startAt: '2026-10-08T05:00:00.000Z',
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'slot_unavailable' });
  });

  it('refuses inactive services', async () => {
    const repo = emptyRepo();
    await repo.saveService({ ...HAIRCUT, isActive: false });
    await expect(getSlotsForService(repo, HAIRCUT.id, '2026-10-08', NOW)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('lists upcoming dates in the provider timezone', () => {
    // 03:00 UTC on the 8th is still the evening of the 7th in Austin.
    expect(upcomingDates(DEMO_TIME_ZONE, 3, new Date('2026-10-08T03:00:00Z'))).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });
});
