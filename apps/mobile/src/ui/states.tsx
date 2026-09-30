import { errorMessage } from '@rn-booking/shared';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from './button';
import { Text } from './text';
import { spacing, useTheme } from './theme';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <Text variant="heading">{title}</Text>
      {body ? (
        <Text muted style={styles.body}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="heading">Something went wrong</Text>
      <Text muted style={styles.body}>
        {errorMessage(error)}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  body: { textAlign: 'center' },
});
