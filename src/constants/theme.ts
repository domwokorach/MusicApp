/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ---------------------------------------------------------------------------
// Sonara music-app design tokens (the exports above are from the Expo starter).
// ---------------------------------------------------------------------------
export { colors } from './colors';

export const radii = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  small: { fontSize: 13, fontWeight: '500' },
  tiny: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
} as const;

/** Gradient options for custom playlist covers. */
export const COVER_OPTIONS: { id: string; colors: [string, string] }[] = [
  { id: 'sunset', colors: ['#FF7A59', '#C2185B'] },
  { id: 'ocean', colors: ['#2193B0', '#6DD5ED'] },
  { id: 'forest', colors: ['#134E5E', '#71B280'] },
  { id: 'violet', colors: ['#8E2DE2', '#4A00E0'] },
  { id: 'gold', colors: ['#F7971E', '#FFD200'] },
  { id: 'berry', colors: ['#D31027', '#EA384D'] },
  { id: 'night', colors: ['#232526', '#414345'] },
  { id: 'mint', colors: ['#11998E', '#38EF7D'] },
];
