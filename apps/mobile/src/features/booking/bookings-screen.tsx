import {
  formatInstant,
  formatPrice,
  type BookingStatus,
  type BookingView,
} from '@rn-booking/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { useSession } from '@/lib/session';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Text,
  spacing,
  useTheme,
  type ThemeColors,
} from '@/ui';

import { useMyBookings, useUpdateBookingStatus } from './queries';

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

function statusColor(status: BookingStatus, theme: ThemeColors) {
  if (status === 'confirmed' || status === 'completed') return theme.success;
  if (status === 'pending') return theme.warning;
  return theme.danger;
}

export function BookingsScreen() {
  const theme = useTheme();
  const { user } = useSession();
  const bookings = useMyBookings();
  const update = useUpdateBookingStatus();
  // Captured once per mount; the list refetches after every change anyway.
  const [now] = useState(() => Date.now());

  if (!user) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <EmptyState title="Sign in to see your bookings" body="Use the Account tab to sign in." />
        <View style={styles.cta}>
          <Button label="Go to Account" onPress={() => router.push('/account')} />
        </View>
      </View>
    );
  }
  if (bookings.isPending) return <LoadingState />;
  if (bookings.isError)
    return <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />;

  const upcoming = bookings.data.filter(
    (b) => Date.parse(b.startAt) >= now && (b.status === 'confirmed' || b.status === 'pending'),
  );
  const past = bookings.data.filter((b) => !upcoming.includes(b)).reverse();
  const sections = [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past.slice(0, 20) },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      keyExtractor={(b) => b.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text variant="heading" style={styles.section}>
          {section.title}
        </Text>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        <EmptyState
          title="No bookings yet"
          body="Find something on Explore or ask the concierge."
        />
      }
      renderItem={({ item }) => (
        <BookingCard
          booking={item}
          cancelling={update.isPending && update.variables.id === item.id}
          onCancel={
            upcoming.includes(item)
              ? () => update.mutate({ id: item.id, status: 'cancelled' })
              : undefined
          }
        />
      )}
    />
  );
}

function BookingCard({
  booking,
  onCancel,
  cancelling,
}: {
  booking: BookingView;
  onCancel?: () => void;
  cancelling: boolean;
}) {
  const theme = useTheme();
  return (
    <Card testID={`booking-${booking.id}`}>
      <View style={styles.row}>
        <Text variant="label" style={styles.flex}>
          {booking.serviceName}
        </Text>
        <Text variant="caption" color={statusColor(booking.status, theme)}>
          {STATUS_LABEL[booking.status]}
        </Text>
      </View>
      <Text muted>{booking.providerName}</Text>
      <Text>
        {formatInstant(booking.startAt, booking.providerTimeZone)} ·{' '}
        {formatPrice(booking.priceCents)}
      </Text>
      {onCancel ? (
        <Button label="Cancel booking" variant="danger" loading={cancelling} onPress={onCancel} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  cta: { padding: spacing.lg },
});
