import { formatClock, type Slot } from '@rn-booking/shared';
import { StyleSheet, View } from 'react-native';

import { Chip, Text, spacing } from '@/ui';

const PERIODS = [
  { label: 'Morning', until: '12:00' },
  { label: 'Afternoon', until: '17:00' },
  { label: 'Evening', until: '24:00' },
] as const;

export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (start: string) => void;
}) {
  const groups = PERIODS.map((period, index) => {
    const from = PERIODS[index - 1]?.until ?? '00:00';
    const items = slots.filter((s) => s.localTime >= from && s.localTime < period.until);
    return { ...period, items };
  }).filter((g) => g.items.length > 0);

  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text variant="caption" muted>
            {group.label}
          </Text>
          <View style={styles.grid}>
            {group.items.map((slot) => (
              <Chip
                key={slot.start}
                testID={`slot-${slot.localTime}`}
                // Repeated wall times on DST fall-back days show their offset.
                label={
                  slots.filter((s) => s.localTime === slot.localTime).length > 1
                    ? `${formatClock(slot.localTime)} (${slot.utcOffset})`
                    : formatClock(slot.localTime)
                }
                selected={selected === slot.start}
                onPress={() => onSelect(slot.start)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
