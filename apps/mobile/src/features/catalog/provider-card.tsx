import { CATEGORY_LABELS, formatDistance, formatPrice } from '@rn-booking/shared';
import { StyleSheet, View } from 'react-native';

import { Card, Text, spacing } from '@/ui';

import type { ProviderSummary } from './group-by-provider';

export function ProviderCard({
  summary,
  onPress,
}: {
  summary: ProviderSummary;
  onPress: () => void;
}) {
  const { provider } = summary;
  return (
    <Card
      onPress={onPress}
      testID={`provider-${provider.id}`}
      accessibilityLabel={`${provider.name}, from ${formatPrice(summary.fromPriceCents)}`}
    >
      <View style={styles.row}>
        <Text variant="heading" style={styles.name}>
          {provider.name}
        </Text>
        <Text variant="label">from {formatPrice(summary.fromPriceCents)}</Text>
      </View>
      <Text variant="caption" muted>
        {CATEGORY_LABELS[provider.category]} · {provider.neighborhood} ·{' '}
        {formatDistance(summary.distanceKm)} · {provider.rating.toFixed(1)} ({provider.reviewCount})
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {summary.serviceNames.join(', ')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1 },
});
