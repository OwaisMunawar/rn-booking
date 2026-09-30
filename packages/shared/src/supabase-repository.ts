import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type { BusyInterval } from './availability';
import type { Database } from './database.types';
import { DomainError } from './errors';
import type { BookingRepository, NewBooking } from './repository';
import {
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

export type { Database } from './database.types';
export type BookingSupabaseClient = SupabaseClient<Database>;

type Tables = Database['public']['Tables'];
type ProviderRow = Tables['providers']['Row'];
type ServiceRow = Tables['services']['Row'];
type RuleRow = Tables['availability_rules']['Row'];
type BookingRow = Tables['bookings']['Row'];

const BOOKING_VIEW_SELECT =
  '*, service:services(name), provider:providers(name, time_zone), customer:profiles(full_name)' as const;

/**
 * Supabase adapter. It talks to Postgres as the signed-in user, so row level
 * security decides what each call can see or change; this class only maps
 * rows to domain objects and Postgres errors to DomainError codes.
 */
export class SupabaseBookingRepository implements BookingRepository {
  readonly mode = 'supabase' as const;

  constructor(private readonly client: BookingSupabaseClient) {}

  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', id)
      .maybeSingle();
    if (error) throw toDomainError(error);
    return data
      ? { id: data.id, fullName: data.full_name, email: data.email, role: data.role }
      : null;
  }

  async listProviders(options: { includeInactive?: boolean } = {}): Promise<Provider[]> {
    let query = this.client.from('providers').select('*').order('name');
    if (!options.includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw toDomainError(error);
    return data.map(mapProvider);
  }

  async getProvider(id: string): Promise<Provider | null> {
    const { data, error } = await this.client
      .from('providers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw toDomainError(error);
    return data ? mapProvider(data) : null;
  }

  async saveProvider(input: ProviderInput): Promise<Provider> {
    const p = providerInputSchema.parse(input);
    const row = {
      user_id: p.userId,
      name: p.name,
      category: p.category,
      bio: p.bio,
      neighborhood: p.neighborhood,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      time_zone: p.timeZone,
      is_active: p.isActive,
    };
    const { data, error } = p.id
      ? await this.client.from('providers').update(row).eq('id', p.id).select('*').single()
      : await this.client.from('providers').insert(row).select('*').single();
    if (error) throw toDomainError(error);
    return mapProvider(data);
  }

  async deleteProvider(id: string): Promise<void> {
    const { error } = await this.client.from('providers').delete().eq('id', id);
    if (error) throw toDomainError(error, 'Provider has bookings. Deactivate it instead.');
  }

  async listServices(filter: ServiceFilter = {}): Promise<ServiceWithProvider[]> {
    let query = this.client
      .from('services')
      .select('*, provider:providers!inner(*)')
      .order('price_cents');
    if (!filter.includeInactive) query = query.eq('is_active', true).eq('provider.is_active', true);
    if (filter.category) query = query.eq('category', filter.category);
    if (filter.providerId) query = query.eq('provider_id', filter.providerId);
    if (filter.maxPriceCents !== undefined) query = query.lte('price_cents', filter.maxPriceCents);
    const term = filter.query?.replace(/[^\p{L}\p{N} ]/gu, '').trim();
    if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);

    const { data, error } = await query;
    if (error) throw toDomainError(error);
    return data
      .map((row) => ({ ...mapService(row), provider: mapProvider(row.provider) }))
      .sort(
        (a, b) => a.provider.name.localeCompare(b.provider.name) || a.priceCents - b.priceCents,
      );
  }

  async getService(id: string): Promise<ServiceWithProvider | null> {
    const { data, error } = await this.client
      .from('services')
      .select('*, provider:providers!inner(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw toDomainError(error);
    return data ? { ...mapService(data), provider: mapProvider(data.provider) } : null;
  }

  async saveService(input: ServiceInput): Promise<ServiceWithProvider> {
    const s = serviceInputSchema.parse(input);
    const row = {
      provider_id: s.providerId,
      name: s.name,
      description: s.description,
      category: s.category,
      duration_minutes: s.durationMinutes,
      buffer_minutes: s.bufferMinutes,
      price_cents: s.priceCents,
      is_active: s.isActive,
    };
    const { data, error } = s.id
      ? await this.client.from('services').update(row).eq('id', s.id).select('id').single()
      : await this.client.from('services').insert(row).select('id').single();
    if (error) throw toDomainError(error);
    const saved = await this.getService(data.id);
    if (!saved) throw new DomainError('not_found', 'Service not found after save');
    return saved;
  }

  async deleteService(id: string): Promise<void> {
    const { error } = await this.client.from('services').delete().eq('id', id);
    if (error) throw toDomainError(error, 'Service has bookings. Deactivate it instead.');
  }

  async listAvailabilityRules(providerId: string): Promise<AvailabilityRule[]> {
    const { data, error } = await this.client
      .from('availability_rules')
      .select('*')
      .eq('provider_id', providerId)
      .order('weekday')
      .order('start_time');
    if (error) throw toDomainError(error);
    return data.map(mapRule);
  }

  async replaceAvailabilityRules(
    providerId: string,
    rules: AvailabilityRuleInput[],
  ): Promise<AvailabilityRule[]> {
    const parsed = rules.map((rule) => availabilityRuleInputSchema.parse(rule));
    const { data, error } = await this.client.rpc('replace_availability_rules', {
      p_provider_id: providerId,
      p_rules: parsed,
    });
    if (error) throw toDomainError(error);
    return data.map(mapRule);
  }

  async listBusyIntervals(providerId: string, from: string, to: string): Promise<BusyInterval[]> {
    const { data, error } = await this.client.rpc('get_busy_intervals', {
      p_provider_id: providerId,
      p_from: from,
      p_to: to,
    });
    if (error) throw toDomainError(error);
    return data.map((row) => ({ start: row.start_at, end: row.end_at }));
  }

  async listBookings(filter: BookingFilter = {}): Promise<BookingView[]> {
    let query = this.client.from('bookings').select(BOOKING_VIEW_SELECT).order('start_at');
    if (filter.customerId) query = query.eq('customer_id', filter.customerId);
    if (filter.providerId) query = query.eq('provider_id', filter.providerId);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.from) query = query.gte('start_at', filter.from);
    if (filter.to) query = query.lt('start_at', filter.to);
    const { data, error } = await query;
    if (error) throw toDomainError(error);
    return data.map((row) => ({
      ...mapBooking(row),
      serviceName: row.service.name,
      providerName: row.provider.name,
      providerTimeZone: row.provider.time_zone,
      customerName: row.customer.full_name || 'Customer',
    }));
  }

  async createBooking(input: NewBooking): Promise<Booking> {
    // The RPC books as auth.uid(); customerId is implied by the session.
    const { data, error } = await this.client
      .rpc('create_booking', {
        p_service_id: input.serviceId,
        p_start_at: input.startAt,
        p_notes: input.notes ?? undefined,
      })
      .single();
    if (error) throw toDomainError(error);
    return mapBooking(data);
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
    const { data, error } = await this.client
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw toDomainError(error);
    return mapBooking(data);
  }
}

/** Maps Postgres / PostgREST error codes to domain errors the UI understands. */
export function toDomainError(error: PostgrestError, conflictMessage?: string): DomainError {
  const options = { cause: error };
  switch (error.code) {
    case '23P01':
      return new DomainError('slot_unavailable', 'That time was just taken.', options);
    case '23514':
      return error.message.includes('working hours')
        ? new DomainError('slot_unavailable', 'That time is outside opening hours.', options)
        : new DomainError('validation', error.message, options);
    case '23503':
      return new DomainError('conflict', conflictMessage ?? 'Record is still referenced.', options);
    case '42501':
      return new DomainError('forbidden', 'You do not have permission to do that.', options);
    case 'PGRST116':
      return new DomainError('not_found', 'Record not found or not visible to you.', options);
    case '22P02':
    case '22007':
      return new DomainError('validation', error.message, options);
    default:
      return new DomainError('backend', error.message, options);
  }
}

function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    bio: row.bio,
    neighborhood: row.neighborhood,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    reviewCount: row.review_count,
    timeZone: row.time_zone,
    isActive: row.is_active,
  };
}

function mapService(row: ServiceRow): Omit<ServiceWithProvider, 'provider'> {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    description: row.description,
    category: row.category,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    priceCents: row.price_cents,
    isActive: row.is_active,
  };
}

function mapRule(row: RuleRow): AvailabilityRule {
  return {
    id: row.id,
    providerId: row.provider_id,
    kind: row.kind,
    weekday: row.weekday,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  };
}

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    serviceId: row.service_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    bufferEndAt: new Date(row.buffer_end_at).toISOString(),
    status: row.status,
    priceCents: row.price_cents,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
