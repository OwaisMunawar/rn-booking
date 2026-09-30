import { useLocalSearchParams } from 'expo-router';

import { BookScreen } from '@/features/booking/book-screen';

export default function BookRoute() {
  const { serviceId, start } = useLocalSearchParams<{ serviceId: string; start?: string }>();
  return (
    <BookScreen key={`${serviceId}-${start ?? ''}`} serviceId={serviceId} initialStart={start} />
  );
}
