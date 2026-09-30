import type { ServiceFilter } from '@rn-booking/shared';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { getRepository } from '@/lib/repository';

export function useServices(filter: ServiceFilter = {}) {
  return useQuery({
    queryKey: queryKeys.services(filter),
    queryFn: () => getRepository().listServices(filter),
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: queryKeys.provider(id),
    queryFn: () => getRepository().getProvider(id),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: queryKeys.service(id),
    queryFn: () => getRepository().getService(id),
  });
}
