import { useColorScheme } from 'react-native';

const palette = {
  light: {
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#EFEFEC',
    border: '#E2E2DE',
    text: '#17181A',
    textMuted: '#62656B',
    primary: '#1F6FEB',
    primaryText: '#FFFFFF',
    primarySoft: '#E3EDFD',
    success: '#1A7F4B',
    successSoft: '#E1F4EA',
    warning: '#9A6700',
    warningSoft: '#FFF4D6',
    danger: '#C2362F',
    dangerSoft: '#FCE8E6',
  },
  dark: {
    background: '#0E0F11',
    surface: '#18191C',
    surfaceMuted: '#222327',
    border: '#2C2E33',
    text: '#F2F2F0',
    textMuted: '#A0A3A9',
    primary: '#4C8DF6',
    primaryText: '#FFFFFF',
    primarySoft: '#1B2A44',
    success: '#4CC38A',
    successSoft: '#15301F',
    warning: '#E3B341',
    warningSoft: '#33290F',
    danger: '#F2766B',
    dangerSoft: '#3A1B19',
  },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
