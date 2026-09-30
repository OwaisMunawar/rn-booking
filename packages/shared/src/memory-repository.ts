import type { BusyInterval } from './availability';
import { bookingsToBusy } from './availability';
import { createDemoData, type DemoData } from './demo-data';
import { DomainError } from './errors';
import type { BookingRepository, NewBooking } from './repository';
import {
  ACTIVE_BOOKING_STATUSES,
  availabilityRuleInputSchema,
  providerInputSchema,
  serviceInputSchema,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type Booking,
  type BookingFilter,
  type BookingStatus,
  type BookingView,
  type Profile,
  type Provider,
  type ProviderInput,
  type ServiceFilter,
  type ServiceInput,
  type ServiceWithProvider,
} from './schemas';
import { addMinutes } from './time';

/** RFC 4122 v4 id without relying on crypto.randomUUID, which Hermes lacks. */
export function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface MemoryRepositoryOptions {
  data?: DemoData;
  now?: () => Date;
}

/**
 * In-memory adapter used in demo mode and in tests. It mirrors the database
 * constraints that matter (no overlapping active bookings per provider,
 * restricted deletes) so demo behaviour matches production.
 */
export class MemoryBookingRepository implements BookingRepository {
  readonly mode = 'demo' as const;
  private readonly data: DemoData;
  private readonly now: () => Date;

  constructor(options: MemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.data = options.data ?? createDemoData(this.now());
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.data.profiles.find((p) => p.id === id) ?? null;
  }

  async listProviders(options: { includeInactive?: boolean } = {}): Promise<Provider[]> {
    return this.data.providers
      .filter((p) => options.includeInactive || p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProvider(id: string): Promise<Provider | null> {
    return this.data.providers.find((p) => p.id === id) ?? null;
  }

  async saveProvider(input: ProviderInput): Promise<Provider> {
    const parsed = providerInputSchema.parse(input);
    const existing = parsed.id ? await this.getProvider(parsed.id) : null;
    if (existing) {
      Object.assign(existing, parsed);
      return existing;
    }
    const created: Provider = { ...parsed, id: parsed.id ?? randomId(), rating: 0, reviewCount: 0 };
    this.data.providers.push(created);
    return created;
  }

  async deleteProvider(id: string): Promise<void> {
    if (this.data.bookings.some((b) => b.providerId === id)) {
      throw new DomainError('conflict', 'Provider has bookings. Deactivate it instead.');
    }
    this.data.providers = this.data.providers.filter((p) => p.id !== id);
    this.data.services = this.data.services.filter((s) => s.providerId !== id);
    this.data.rules = this.data.rules.filter((r) => r.providerId !== id);
  }

  async listServices(filter: ServiceFilter = {}): Promise<ServiceWithProvider[]> {
    const query = filter.query?.trim().toLowerCase();
    return this.data.services
      .map((service) => this.withProvider(service))
      .filter((s): s is ServiceWithProvider => s !== null)
      .filter((s) => filter.includeInactive || (s.isActive && s.provider.isActive))
      .filter((s) => !filter.category || s.category === filter.category)
      .filter((s) => !filter.providerId || s.providerId === filter.providerId)
      .filter((s) => filter.maxPriceCents === undefined || s.priceCents <= filter.maxPriceCents)
      .filter(
        (s) =>
          !query || `${s.name} ${s.description} ${s.provider.name}`.toLowerCase().includes(query),
      )
      .sort(
        (a, b) => a.provider.name.localeCompare(b.provider.name) || a.priceCents - b.priceCents,
      );
  }

  async getService(id: string): Promise<ServiceWithProvider | null> {
    const service = this.data.services.find((s) => s.id === id);
    return service ? this.withProvider(service) : null;
  }

  async saveService(input: ServiceInput): Promise<ServiceWithProvider> {
    const parsed = serviceInputSchema.parse(input);
    if (!(await this.getProvider(parsed.providerId))) {
      throw new DomainError('not_found', 'Provider not found');
    }
    const existing = parsed.id ? this.data.services.find((s) => s.id === parsed.id) : undefined;
    const service = existing
      ? Object.assign(existing, parsed)
      : { ...parsed, id: parsed.id ?? randomId() };
    if (!existing) this.data.services.push(service);
    const result = this.withProvider(service);
    if (!result) throw new DomainError('not_found', 'Provider not found');
    return result;
  }

  async deleteService(id: string): Promise<void> {
    if (this.data.bookings.some((b) => b.serviceId === id)) {
      throw new DomainError('conflict', 'Service has bookings. Deactivate it instead.');
    }
    this.data.services = this.data.services.filter((s) => s.id !== id);
  }

  async listAvailabilityRules(providerId: string): Promise<AvailabilityRule[]> {
    return this.data.rules
      .filter((r) => r.providerId === providerId)
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  }

  async replaceAvailabilityRules(
    providerId: string,
    rules: AvailabilityRuleInput[],
  ): Promise<AvailabilityRule[]> {
    const parsed = rules.map((rule) => availabilityRuleInputSchema.parse(rule));
    this.data.rules = [
      ...this.data.rules.filter((r) => r.providerId !== providerId),
      ...parsed.map((rule) => ({ ...rule, id: randomId(), providerId })),
    ];
    return this.listAvailabilityRules(providerId);
  }

  async listBusyIntervals(providerId: string, from: string, to: string): Promise<BusyInterval[]> {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return bookingsToBusy(this.data.bookings.filter((b) => b.providerId === providerId)).filter(
      (i) => new Date(i.end).getTime() > fromMs && new Date(i.start).getTime() < toMs,
    );
  }

  async listBookings(filter: BookingFilter = {}): Promise<BookingView[]> {
    const from = filter.from ? new Date(filter.from).getTime() : Number.NEGATIVE_INFINITY;
    const to = filter.to ? new Date(filter.to).getTime() : Number.POSITIVE_INFINITY;
    return this.data.bookings
      .filter((b) => !filter.customerId || b.customerId === filter.customerId)
      .filter((b) => !filter.providerId || b.providerId === filter.providerId)
      .filter((b) => !filter.status || b.status === filter.status)
      .filter((b) => {
        const start = new Date(b.startAt).getTime();
        return start >= from && start < to;
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((b) => this.toView(b));
  }

  async createBooking(input: NewBooking): Promise<Booking> {
    const service = await this.getService(input.serviceId);
    if (!service) throw new DomainError('not_found', 'Service not found');

    const start = new Date(input.startAt);
    const booking: Booking = {
      id: randomId(),
      customerId: input.customerId,
      providerId: service.providerId,
      serviceId: service.id,
      startAt: start.toISOString(),
      endAt: addMinutes(start, service.durationMinutes).toISOString(),
      bufferEndAt: addMinutes(start, service.durationMinutes + service.bufferMinutes).toISOString(),
      status: 'confirmed',
      priceCents: service.priceCents,
      notes: input.notes ?? null,
      createdAt: this.now().toISOString(),
    };

    // Same guarantee as the bookings_no_overlap exclusion constraint in Postgres.
    const clash = this.data.bookings.some(
      (b) =>
        b.providerId === booking.providerId &&
        ACTIVE_BOOKING_STATUSES.includes(b.status) &&
        Date.parse(b.startAt) < Date.parse(booking.bufferEndAt) &&
        Date.parse(booking.startAt) < Date.parse(b.bufferEndAt),
    );
    if (clash) throw new DomainError('slot_unavailable', 'That time was just taken.');

    this.data.bookings.push(booking);
    return booking;
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
    const booking = this.data.bookings.find((b) => b.id === id);
    if (!booking) throw new DomainError('not_found', 'Booking not found');
    booking.status = status;
    return booking;
  }

  private withProvider(service: DemoData['services'][number]): ServiceWithProvider | null {
    const provider = this.data.providers.find((p) => p.id === service.providerId);
    return provider ? { ...service, provider } : null;
  }

  private toView(booking: Booking): BookingView {
    const service = this.data.services.find((s) => s.id === booking.serviceId);
    const provider = this.data.providers.find((p) => p.id === booking.providerId);
    const customer = this.data.profiles.find((p) => p.id === booking.customerId);
    return {
      ...booking,
      serviceName: service?.name ?? 'Deleted service',
      providerName: provider?.name ?? 'Deleted provider',
      providerTimeZone: provider?.timeZone ?? 'UTC',
      customerName: customer?.fullName ?? 'Guest',
    };
  }
}
