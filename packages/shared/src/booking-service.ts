import {
  getAvailableSlots,
  isSlotAvailable,
  type AvailabilityInput,
  type Slot,
} from './availability';
import { DomainError } from './errors';
import type { BookingRepository, NewBooking } from './repository';
import type { Booking, ServiceWithProvider } from './schemas';
import { addDays, toLocalDate, zonedTimeToUtc } from './time';

/** Customers must book at least this far ahead. */
export const MIN_NOTICE_MINUTES = 30;
export const SLOT_STEP_MINUTES = 15;

async function buildInput(
  repo: BookingRepository,
  service: ServiceWithProvider,
  date: string,
  now: Date,
): Promise<AvailabilityInput> {
  const { provider } = service;
  // Pad the busy window by a day on each side; bookings near midnight still count.
  const from = zonedTimeToUtc(addDays(date, -1), 0, provider.timeZone).toISOString();
  const to = zonedTimeToUtc(addDays(date, 2), 0, provider.timeZone).toISOString();
  const [rules, busy] = await Promise.all([
    repo.listAvailabilityRules(provider.id),
    repo.listBusyIntervals(provider.id, from, to),
  ]);
  return {
    date,
    timeZone: provider.timeZone,
    rules,
    busy,
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    stepMinutes: SLOT_STEP_MINUTES,
    now,
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  };
}

async function requireService(repo: BookingRepository, serviceId: string) {
  const service = await repo.getService(serviceId);
  if (!service || !service.isActive || !service.provider.isActive) {
    throw new DomainError('not_found', 'This service is not available for booking.');
  }
  return service;
}

export async function getSlotsForService(
  repo: BookingRepository,
  serviceId: string,
  date: string,
  now: Date = new Date(),
): Promise<Slot[]> {
  const service = await requireService(repo, serviceId);
  return getAvailableSlots(await buildInput(repo, service, date, now));
}

/**
 * Validates a requested start time against live availability, then writes it.
 * The database constraint remains the final word if two requests race.
 */
export async function bookSlot(
  repo: BookingRepository,
  request: NewBooking,
  now: Date = new Date(),
): Promise<Booking> {
  const service = await requireService(repo, request.serviceId);
  const date = toLocalDate(new Date(request.startAt), service.provider.timeZone);
  const input = await buildInput(repo, service, date, now);
  if (!isSlotAvailable(input, request.startAt)) {
    throw new DomainError('slot_unavailable', 'That time is no longer available.');
  }
  return repo.createBooking(request);
}

/** Next `count` calendar dates in the provider's timezone, starting today. */
export function upcomingDates(timeZone: string, count: number, now: Date = new Date()): string[] {
  const today = toLocalDate(now, timeZone);
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}
