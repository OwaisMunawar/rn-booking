import { useLocalSearchParams } from 'expo-router';

import { ProviderScreen } from '@/features/catalog/provider-screen';

export default function ProviderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProviderScreen providerId={id} />;
}
