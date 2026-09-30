import {
  DEMO_LOCATION,
  distanceKm,
  type Provider,
  type ServiceWithProvider,
} from '@rn-booking/shared';

export interface ProviderSummary {
  provider: Provider;
  fromPriceCents: number;
  serviceNames: string[];
  distanceKm: number;
}

/** Collapses a service list into one row per provider, nearest first. */
export function groupByProvider(services: ServiceWithProvider[]): ProviderSummary[] {
  const byProvider = new Map<string, ProviderSummary>();
  for (const service of services) {
    const existing = byProvider.get(service.providerId);
    if (existing) {
      existing.fromPriceCents = Math.min(existing.fromPriceCents, service.priceCents);
      existing.serviceNames.push(service.name);
    } else {
      byProvider.set(service.providerId, {
        provider: service.provider,
        fromPriceCents: service.priceCents,
        serviceNames: [service.name],
        distanceKm: distanceKm(DEMO_LOCATION, service.provider),
      });
    }
  }
  return [...byProvider.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}
