import type { ServiceFilter } from '@rn-booking/shared';

export const queryKeys = {
  providers: ['providers'] as const,
  provider: (id: string) => ['providers', id] as const,
  services: (filter: ServiceFilter) => ['services', filter] as const,
  service: (id: string) => ['service', id] as const,
  slots: (serviceId: string, date: string) => ['slots', serviceId, date] as const,
  bookings: (customerId: string | null) => ['bookings', customerId] as const,
};
