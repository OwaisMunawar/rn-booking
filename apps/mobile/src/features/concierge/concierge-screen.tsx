import {
  formatClock,
  formatDateLabel,
  formatDistance,
  formatPrice,
  type ConciergeResponse,
} from '@rn-booking/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, Chip, Text, radius, spacing, useTheme } from '@/ui';

import { askConcierge } from './api';

const EXAMPLES = [
  'Haircut near me Saturday afternoon under $40',
  'Deep tissue massage tomorrow evening',
  'Gel nails after 3pm on Friday',
  'Dog grooming this weekend',
];

const MODE_LABEL: Record<ConciergeResponse['mode'], string> = {
  live: 'AI model',
  demo: 'Demo model',
  offline: 'On-device rules',
};

export function ConciergeScreen() {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const ask = useMutation({ mutationFn: (text: string) => askConcierge(text) });

  const submit = (text = message) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setMessage(trimmed);
    ask.mutate(trimmed);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title">What do you need?</Text>
        <Text muted>
          Describe it in plain words. The concierge searches services and checks live availability.
        </Text>

        <TextInput
          testID="concierge-input"
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={() => submit()}
          placeholder="e.g. haircut near me Saturday afternoon under $40"
          placeholderTextColor={theme.textMuted}
          returnKeyType="search"
          multiline
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
        />
        <Button
          testID="concierge-submit"
          label="Find times"
          loading={ask.isPending}
          onPress={() => submit()}
        />

        {!ask.data && !ask.isPending ? (
          <View style={styles.examples}>
            {EXAMPLES.map((example) => (
              <Chip key={example} label={example} onPress={() => submit(example)} />
            ))}
          </View>
        ) : null}

        {ask.data ? <ConciergeAnswer response={ask.data} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConciergeAnswer({ response }: { response: ConciergeResponse }) {
  const theme = useTheme();
  return (
    <View style={styles.answer} testID="concierge-answer">
      <View style={styles.chips}>
        {response.interpretation.map((chip) => (
          <View key={chip} style={[styles.tag, { backgroundColor: theme.primarySoft }]}>
            <Text variant="caption" color={theme.primary}>
              {chip}
            </Text>
          </View>
        ))}
      </View>
      <Text>{response.reply}</Text>
      <Text variant="caption" muted>
        Answered by: {MODE_LABEL[response.mode]}
      </Text>

      {response.results.map(({ service, date, slots }) => (
        <Card key={`${service.serviceId}-${date}`}>
          <Text variant="label">
            {service.serviceName} · {formatPrice(service.priceCents)}
          </Text>
          <Text variant="caption" muted>
            {service.providerName} · {service.neighborhood} · {formatDistance(service.distanceKm)} ·{' '}
            {formatDateLabel(date)}
          </Text>
          <View style={styles.chips}>
            {slots.map((slot) => (
              <Chip
                key={slot.start}
                testID={`concierge-slot-${slot.start}`}
                label={formatClock(slot.localTime)}
                onPress={() =>
                  router.push({
                    pathname: '/book/[serviceId]',
                    params: { serviceId: service.serviceId, start: slot.start },
                  })
                }
              />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  examples: { gap: spacing.sm, alignItems: 'flex-start' },
  answer: { gap: spacing.md, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
});
