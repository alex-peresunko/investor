import { type MantineColorsTuple, createTheme } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#eef0ff',
  '#dcdfff',
  '#b6bcfb',
  '#8e96f7',
  '#6c75f3',
  '#575ff1',
  '#4b53f1',
  '#3c44d7',
  '#343cc1',
  '#2832aa',
];

// Bluish night palette instead of Mantine's neutral grays.
const dark: MantineColorsTuple = [
  '#c9cce0',
  '#a6aac6',
  '#7d82a3',
  '#5a5f80',
  '#3b3f5c',
  '#2a2e47',
  '#1d2035',
  '#161929',
  '#10121f',
  '#0b0d17',
];

export const theme = createTheme({
  colors: { brand, dark },
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  defaultGradient: { from: 'brand.6', to: 'cyan.5', deg: 135 },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  headings: { fontWeight: '700' },
  components: {
    Paper: { defaultProps: { radius: 'lg', shadow: 'xs' } },
    Button: { defaultProps: { variant: 'gradient' } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
});
