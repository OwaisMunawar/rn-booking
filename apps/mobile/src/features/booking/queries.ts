import { bookSlot, DomainError, getSlotsForService, type BookingStatus } from '@rn-booking/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { getRepository } from '@/lib/repository';
import { useSession } from '@/lib/session';

export function useSlots(serviceId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.slots(serviceId, date),
    queryFn: () => getSlotsForService(getRepository(), serviceId, date),
    // Availability goes stale quickly; refetch whenever the screen is revisited.
    staleTime: 15_000,
  });
}

export function useBookSlot(serviceId: string) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { startAt: string; notes?: string }) => {
      if (!user) throw new DomainError('unauthenticated', 'Sign in on the Account tab to book.');
      return bookSlot(getRepository(), { customerId: user.id, serviceId, ...input });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['slots', serviceId] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      ]);
    },
  });
}

export function useMyBookings() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.bookings(user?.id ?? null),
    queryFn: () => getRepository().listBookings({ customerId: user?.id }),
    enabled: user !== null,
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      getRepository().updateBookingStatus(id, status),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}
