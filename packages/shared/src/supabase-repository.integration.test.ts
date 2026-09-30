import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getSlotsForService } from './booking-service';
import { demoProviders, demoServices, DEMO_USERS } from './demo-data';
import { DomainError } from './errors';
import { DEMO_PASSWORD } from './seed-sql';
import {
  SupabaseBookingRepository,
  type BookingSupabaseClient,
  type Database,
} from './supabase-repository';
import { addDays, toLocalDate } from './time';

/**
 * Exercises the Supabase adapter, RLS policies, triggers and the exclusion
 * constraint against a real local stack. Point it elsewhere with
 * SUPABASE_URL / SUPABASE_ANON_KEY; defaults match supabase/config.toml.
 */

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54421';
// The well-known anon key every local Supabase stack ships with.
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const FADE = demoProviders[0]!;
const LOFT_CUT = demoServices.find((s) => s.providerId === demoProviders[1]!.id)!;
const HAIRCUT = demoServices[0]!;

function client(): BookingSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string): Promise<BookingSupabaseClient> {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

let anon: SupabaseBookingRepository;
let customer: SupabaseBookingRepository;
let otherCustomer: SupabaseBookingRepository;
let provider: SupabaseBookingRepository;
let admin: SupabaseBookingRepository;
let customerClient: BookingSupabaseClient;
const createdIds: string[] = [];

/** A bookable slot a few days out, found through the public API like the app does. */
async function freeSlot(serviceId: string, offset = 0): Promise<string> {
  const base = toLocalDate(new Date(), FADE.timeZone);
  for (let day = 3; day < 12; day++) {
    const slots = await getSlotsForService(anon, serviceId, addDays(base, day));
    const slot = slots[Math.min(offset, slots.length - 1)];
    if (slot) return slot.start;
  }
  throw new Error('No free slot found');
}

beforeAll(async () => {
  anon = new SupabaseBookingRepository(client());
  customerClient = await signedIn('customer@example.com');
  customer = new SupabaseBookingRepository(customerClient);
  otherCustomer = new SupabaseBookingRepository(await signedIn('jordan@example.com'));
  provider = new SupabaseBookingRepository(await signedIn('provider@example.com'));
  admin = new SupabaseBookingRepository(await signedIn('admin@example.com'));
});

afterAll(async () => {
  for (const id of createdIds)
    await admin.updateBookingStatus(id, 'cancelled').catch(() => undefined);
});

describe('catalogue', () => {
  it('is readable anonymously', async () => {
    const services = await anon.listServices({ category: 'hair', maxPriceCents: 4000 });
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s.priceCents <= 4000 && s.provider.name)).toBe(true);
    expect(await anon.listAvailabilityRules(FADE.id)).not.toHaveLength(0);
    expect((await anon.getService(HAIRCUT.id))?.provider.id).toBe(FADE.id);
    expect((await anon.getProvider(FADE.id))?.timeZone).toBe('America/Chicago');
  });

  it('supports text search', async () => {
    const results = await anon.listServices({ query: 'beard' });
    expect(results.map((s) => s.name)).toContain('Beard trim');
  });

  it('exposes busy intervals without customer data', async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const busy = await anon.listBusyIntervals(FADE.id, from, to);
    expect(busy.length).toBeGreaterThan(0);
    expect(Object.keys(busy[0]!)).toEqual(['start', 'end']);
  });
});

describe('bookings and RLS', () => {
  it('denies anonymous users any access to bookings', async () => {
    await expect(anon.listBookings()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('shows customers only their own bookings', async () => {
    const mine = await customer.listBookings();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.customerId === DEMO_USERS.customer)).toBe(true);
  });

  it("shows providers only their own provider's bookings", async () => {
    const theirs = await provider.listBookings();
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((b) => b.providerId === FADE.id)).toBe(true);
    expect(theirs.some((b) => b.customerName !== 'Customer')).toBe(true);
  });

  it('shows admins everything', async () => {
    const all = await admin.listBookings();
    expect(new Set(all.map((b) => b.providerId)).size).toBe(demoProviders.length);
  });

  it('books a slot, derives price and buffer, and lets the customer cancel', async () => {
    const startAt = await freeSlot(HAIRCUT.id);
    const booking = await customer.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt,
    });
    createdIds.push(booking.id);
    expect(booking).toMatchObject({
      providerId: FADE.id,
      priceCents: HAIRCUT.priceCents,
      status: 'confirmed',
    });
    expect(Date.parse(booking.bufferEndAt) - Date.parse(booking.startAt)).toBe(
      (HAIRCUT.durationMinutes + HAIRCUT.bufferMinutes) * 60_000,
    );
    expect((await customer.updateBookingStatus(booking.id, 'cancelled')).status).toBe('cancelled');
  });

  it('rejects a double booking at the database, buffers included', async () => {
    const startAt = await freeSlot(HAIRCUT.id, 2);
    const first = await customer.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt,
    });
    createdIds.push(first.id);
    // 30 minute cut + 10 minute buffer: a start 35 minutes later overlaps the buffer.
    const overlapping = new Date(Date.parse(startAt) + 35 * 60_000).toISOString();
    await expect(
      otherCustomer.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt: overlapping,
      }),
    ).rejects.toMatchObject({ code: 'slot_unavailable' });
  });

  it('lets exactly one of two concurrent requests win', async () => {
    const startAt = await freeSlot(HAIRCUT.id, 4);
    const results = await Promise.allSettled([
      customer.createBooking({ customerId: DEMO_USERS.customer, serviceId: HAIRCUT.id, startAt }),
      otherCustomer.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt,
      }),
    ]);
    const won = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost[0]?.reason).toBeInstanceOf(DomainError);
    createdIds.push(...won.map((b) => b.id));
  });

  it('rejects bookings outside working hours', async () => {
    // 03:00 in Austin, a few days out.
    const date = addDays(toLocalDate(new Date(), FADE.timeZone), 4);
    await expect(
      customer.createBooking({
        customerId: DEMO_USERS.customer,
        serviceId: HAIRCUT.id,
        startAt: `${date}T08:00:00Z`,
      }),
    ).rejects.toMatchObject({ code: 'slot_unavailable' });
  });

  it('stops customers from marking bookings completed', async () => {
    const startAt = await freeSlot(HAIRCUT.id, 6);
    const booking = await customer.createBooking({
      customerId: DEMO_USERS.customer,
      serviceId: HAIRCUT.id,
      startAt,
    });
    createdIds.push(booking.id);
    await expect(customer.updateBookingStatus(booking.id, 'completed')).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect((await provider.updateBookingStatus(booking.id, 'completed')).status).toBe('completed');
  });

  it("does not let one customer touch another's booking", async () => {
    const [mine] = await customer.listBookings({ status: 'confirmed' });
    expect(mine).toBeDefined();
    await expect(otherCustomer.updateBookingStatus(mine!.id, 'cancelled')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('ownership', () => {
  it('lets providers edit their own services but not others', async () => {
    const own = await provider.saveService({ ...HAIRCUT, description: HAIRCUT.description });
    expect(own.id).toBe(HAIRCUT.id);
    await expect(provider.saveService({ ...LOFT_CUT, priceCents: 1 })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('stops providers reassigning their listing', async () => {
    await expect(
      provider.saveProvider({ ...FADE, id: FADE.id, userId: DEMO_USERS.admin }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets only admins create providers', async () => {
    const input = {
      ...FADE,
      id: undefined,
      userId: null,
      name: 'Integration Test Barber',
      isActive: false,
    };
    await expect(provider.saveProvider(input)).rejects.toMatchObject({ code: 'forbidden' });
    const created = await admin.saveProvider(input);
    await admin.deleteProvider(created.id);
    expect(await admin.getProvider(created.id)).toBeNull();
  });

  it('restricts deleting a provider that has bookings', async () => {
    await expect(admin.deleteProvider(FADE.id)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('replaces availability atomically, only for owners', async () => {
    const rules = await provider.listAvailabilityRules(FADE.id);
    const inputs = rules.map(({ kind, weekday, startTime, endTime }) => ({
      kind,
      weekday,
      startTime,
      endTime,
    }));
    await expect(
      provider.replaceAvailabilityRules(demoProviders[1]!.id, inputs),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const saved = await provider.replaceAvailabilityRules(FADE.id, inputs);
    expect(saved).toHaveLength(rules.length);
  });

  it('prevents role escalation through profiles', async () => {
    const { error } = await customerClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', DEMO_USERS.customer);
    expect(error?.code).toBe('42501');
    expect((await customer.getProfile(DEMO_USERS.customer))?.role).toBe('customer');
  });
});
