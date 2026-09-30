import { CATEGORY_LABELS, formatDuration, formatPrice } from '@rn-booking/shared';
import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, Text, spacing, useTheme } from '@/ui';

import { useProvider, useServices } from './queries';

export function ProviderScreen({ providerId }: { providerId: string }) {
  const theme = useTheme();
  const provider = useProvider(providerId);
  const services = useServices({ providerId });

  if (provider.isPending) return <LoadingState />;
  if (provider.isError)
    return <ErrorState error={provider.error} onRetry={() => void provider.refetch()} />;
  if (!provider.data) return <EmptyState title="Provider not found" />;
  const p = provider.data;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: p.name }} />
      <View style={styles.header}>
        <Text variant="title">{p.name}</Text>
        <Text muted>
          {CATEGORY_LABELS[p.category]} · {p.rating.toFixed(1)} from {p.reviewCount} reviews
        </Text>
        <Text muted>
          {p.address}, {p.neighborhood}
        </Text>
        <Text>{p.bio}</Text>
      </View>

      <Text variant="heading">Services</Text>
      {services.isPending ? <LoadingState /> : null}
      {services.data?.map((service) => (
        <Card
          key={service.id}
          testID={`service-${service.id}`}
          accessibilityLabel={`Book ${service.name}`}
          onPress={() =>
            router.push({ pathname: '/book/[serviceId]', params: { serviceId: service.id } })
          }
        >
          <View style={styles.row}>
            <Text variant="label" style={styles.flex}>
              {service.name}
            </Text>
            <Text variant="label">{formatPrice(service.priceCents)}</Text>
          </View>
          <Text variant="caption" muted>
            {formatDuration(service.durationMinutes)} · {service.description}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
