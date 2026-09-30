import { formatDateLabel } from '@rn-booking/shared';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, radius, spacing, useTheme } from '@/ui';

export function DateStrip({
  dates,
  selected,
  onSelect,
}: {
  dates: string[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {dates.map((date, index) => {
        const active = date === selected;
        const [weekday = '', monthDay = ''] = formatDateLabel(date).split(', ');
        return (
          <Pressable
            key={date}
            testID={`date-${date}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={formatDateLabel(date, { weekday: 'long' })}
            onPress={() => onSelect(date)}
            style={[
              styles.day,
              {
                backgroundColor: active ? theme.primary : theme.surface,
                borderColor: active ? theme.primary : theme.border,
              },
            ]}
          >
            <Text variant="caption" color={active ? theme.primaryText : theme.textMuted}>
              {index === 0 ? 'Today' : weekday}
            </Text>
            <Text variant="label" color={active ? theme.primaryText : theme.text}>
              {monthDay}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  day: {
    width: 68,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 2,
  },
});
