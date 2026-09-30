import {
  errorMessage,
  formatDuration,
  formatInstant,
  formatPrice,
  isDomainError,
  toLocalDate,
  upcomingDates,
} from '@rn-booking/shared';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useService } from '@/features/catalog/queries';
import { Button, Card, EmptyState, ErrorState, LoadingState, Text, spacing, useTheme } from '@/ui';

import { DateStrip } from './date-strip';
import { useBookSlot, useSlots } from './queries';
import { SlotGrid } from './slot-grid';

const DAYS_AHEAD = 14;

export function BookScreen({
  serviceId,
  initialStart,
}: {
  serviceId: string;
  initialStart?: string;
}) {
  const theme = useTheme();
  const service = useService(serviceId);
  const timeZone = service.data?.provider.timeZone;
  const dates = useMemo(() => (timeZone ? upcomingDates(timeZone, DAYS_AHEAD) : []), [timeZone]);

  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialStart ?? null);
  const date =
    pickedDate ??
    (initialStart && timeZone ? toLocalDate(new Date(initialStart), timeZone) : dates[0]);

  const slots = useSlots(serviceId, date ?? '');
  const book = useBookSlot(serviceId);

  if (service.isPending) return <LoadingState />;
  if (service.isError)
    return <ErrorState error={service.error} onRetry={() => void service.refetch()} />;
  if (!service.data || !date) return <EmptyState title="Service not found" />;
  const s = service.data;
  const stillAvailable =
    selected !== null && (slots.data ?? []).some((slot) => slot.start === selected);

  const confirm = () => {
    if (!selected) return;
    book.mutate(
      { startAt: selected },
      {
        onSuccess: () => {
          if (Platform.OS !== 'web')
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/bookings');
        },
      },
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Book' }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Card>
          <Text variant="heading">{s.name}</Text>
          <Text muted>
            {s.provider.name} · {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
          </Text>
        </Card>

        <Text variant="heading">Pick a day</Text>
        <DateStrip
          dates={dates}
          selected={date}
          onSelect={(next) => {
            setPickedDate(next);
            setSelected(null);
          }}
        />

        <Text variant="heading">Pick a time</Text>
        {slots.isPending ? (
          <LoadingState />
        ) : slots.isError ? (
          <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
        ) : slots.data.length === 0 ? (
          <EmptyState title="Fully booked" body="No open times on this day. Try another date." />
        ) : (
          <SlotGrid slots={slots.data} selected={selected} onSelect={setSelected} />
        )}
        <Text variant="caption" muted>
          Times are shown in the provider&apos;s timezone ({s.provider.timeZone}).
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {book.isError ? (
          <Text variant="caption" color={theme.danger} testID="booking-error">
            {isDomainError(book.error) && book.error.code === 'slot_unavailable'
              ? 'Someone just booked that time. Please pick another.'
              : errorMessage(book.error)}
          </Text>
        ) : null}
        <Button
          testID="confirm-booking"
          label={
            selected && stillAvailable
              ? `Book ${formatInstant(selected, s.provider.timeZone)}`
              : 'Choose a time'
          }
          disabled={!stillAvailable}
          loading={book.isPending}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
