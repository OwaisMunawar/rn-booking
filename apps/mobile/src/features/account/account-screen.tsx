import { errorMessage } from '@rn-booking/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { useSession } from '@/lib/session';
import { Button, Card, Text, radius, spacing, useTheme } from '@/ui';

export function AccountScreen() {
  const theme = useTheme();
  const { mode, user, signIn, signOut } = useSession();
  const [email, setEmail] = useState('customer@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Card>
        <Text variant="label">{mode === 'demo' ? 'Demo mode' : 'Connected to Supabase'}</Text>
        <Text variant="caption" muted>
          {mode === 'demo'
            ? 'Data is seeded in memory on this device and resets when the app restarts. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to use a real backend.'
            : 'Bookings are stored in Postgres and protected by row level security.'}
        </Text>
      </Card>

      {user ? (
        <Card>
          <Text variant="heading">{user.name}</Text>
          {user.email ? <Text muted>{user.email}</Text> : null}
          {mode === 'supabase' ? (
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text variant="heading">Sign in</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
          />
          {error ? (
            <Text variant="caption" color={theme.danger}>
              {error}
            </Text>
          ) : null}
          <Button label="Sign in" loading={busy} onPress={() => void submit()} />
          <Text variant="caption" muted>
            Seeded local accounts are listed in the README.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
});
