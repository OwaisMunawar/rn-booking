import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from './theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption';

const variants = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
} as const;

export function Text({
  variant = 'body',
  muted = false,
  color,
  style,
  ...props
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const theme = useTheme();
  return (
    <RNText
      style={[variants[variant], { color: color ?? (muted ? theme.textMuted : theme.text) }, style]}
      {...props}
    />
  );
}
