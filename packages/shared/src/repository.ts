import type { BusyInterval } from './availability';
import type {
  AvailabilityRule,
  AvailabilityRuleInput,
  Booking,
  BookingFilter,
  BookingStatus,
  BookingView,
  Profile,
  Provider,
  ProviderInput,
  ServiceFilter,
  ServiceInput,
  ServiceWithProvider,
} from './schemas';

export type DataMode = 'demo' | 'supabase';

export interface NewBooking {
  customerId: string;
  serviceId: string;
  startAt: string;
  notes?: string | null;
}

/**
 * Storage port used by the mobile app, the concierge route and the admin panel.
 *
 * Two adapters implement it: an in-memory store seeded with demo data, and a
 * Supabase adapter. Authorisation lives below this interface (RLS in Postgres,
 * the admin's server-side guards in demo mode), so callers pass plain filters.
 */
export interface BookingRepository {
  readonly mode: DataMode;

  getProfile(id: string): Promise<Profile | null>;

  listProviders(options?: { includeInactive?: boolean }): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
  saveProvider(input: ProviderInput): Promise<Provider>;
  deleteProvider(id: string): Promise<void>;

  listServices(filter?: ServiceFilter): Promise<ServiceWithProvider[]>;
  getService(id: string): Promise<ServiceWithProvider | null>;
  saveService(input: ServiceInput): Promise<ServiceWithProvider>;
  deleteService(id: string): Promise<void>;

  listAvailabilityRules(providerId: string): Promise<AvailabilityRule[]>;
  replaceAvailabilityRules(
    providerId: string,
    rules: AvailabilityRuleInput[],
  ): Promise<AvailabilityRule[]>;

  /** Time held by active bookings, including buffers. Carries no customer data. */
  listBusyIntervals(providerId: string, from: string, to: string): Promise<BusyInterval[]>;

  listBookings(filter?: BookingFilter): Promise<BookingView[]>;
  /** Persists a booking. Callers should validate the slot first (see bookSlot). */
  createBooking(input: NewBooking): Promise<Booking>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking>;
}
