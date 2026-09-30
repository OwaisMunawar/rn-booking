import { CATEGORY_LABELS, categorySchema, type Category } from '@rn-booking/shared';
import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip, EmptyState, ErrorState, LoadingState, Text, radius, spacing, useTheme } from '@/ui';

import { groupByProvider } from './group-by-provider';
import { ProviderCard } from './provider-card';
import { useServices } from './queries';

export function ExploreScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | undefined>();
  const query = useDeferredValue(search.trim());
  const services = useServices({ query: query || undefined, category });
  const rows = useMemo(() => groupByProvider(services.data ?? []), [services.data]);

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(row) => row.provider.id}
      renderItem={({ item }) => (
        <ProviderCard
          summary={item}
          onPress={() =>
            router.push({ pathname: '/provider/[id]', params: { id: item.provider.id } })
          }
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            testID="explore-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search haircuts, massage, cleaning..."
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.search,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
            {categorySchema.options.map((c) => (
              <Chip
                key={c}
                label={CATEGORY_LABELS[c]}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
          {rows.length > 0 ? (
            <Text variant="caption" muted>
              {rows.length} {rows.length === 1 ? 'place' : 'places'} near Downtown Austin
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        services.isPending ? (
          <LoadingState />
        ) : services.isError ? (
          <ErrorState error={services.error} onRetry={() => void services.refetch()} />
        ) : (
          <EmptyState title="Nothing matches" body="Try a different search or category." />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  chips: { gap: spacing.sm },
});
