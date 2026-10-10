/**
 * Design tokens for both schemes.
 *
 * Every colour the app draws comes from a `Theme`, never from a module-level
 * constant, because a `StyleSheet.create` at import time freezes whatever the
 * colours were on first load and can never follow a theme change. Screens build
 * their styles through `useThemedStyles` in `theme-context.tsx` instead.
 *
 * The two palettes are separate objects rather than one palette with opacity
 * tricks: a hue that reads well on near-black is usually too light on white, so
 * the light palette carries its own, darker bases.
 */

export type Scheme = 'light' | 'dark';

export const darkColors = {
  // Surfaces, darkest to lightest.
  bg: '#08080C',
  bgElevated: '#0E0E15',
  surface: '#14141E',
  surfaceHi: '#1C1C29',
  surfacePress: '#232335',

  border: 'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.13)',

  text: '#F4F4F8',
  textDim: '#A0A0B4',
  textFaint: '#63637A',

  /** Text that sits on top of `accent` / `text` fills. */
  onAccent: '#08080C',

  accent: '#6D5BFF',
  accentSoft: 'rgba(109,91,255,0.16)',

  present: '#2ED573',
  presentSoft: 'rgba(46,213,115,0.14)',
  absent: '#FF4D6A',
  absentSoft: 'rgba(255,77,106,0.14)',
  cancelled: '#8C8CA8',
  cancelledSoft: 'rgba(140,140,168,0.14)',

  warn: '#FFB020',
  warnSoft: 'rgba(255,176,32,0.14)',

  /** Meter troughs and the target hairline drawn across them. */
  track: 'rgba(255,255,255,0.07)',
  trackMark: 'rgba(255,255,255,0.38)',

  /** Timetable: a period with nothing in it, and today's column wash. */
  cellEmpty: 'rgba(255,255,255,0.018)',
  cellEmptyBorder: 'rgba(255,255,255,0.03)',
  todayTint: 'rgba(109,91,255,0.05)',
};

/** Same keys, retuned for a light background. */
export const lightColors: typeof darkColors = {
  bg: '#F5F5F9',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHi: '#ECECF3',
  surfacePress: '#DFDFEA',

  border: 'rgba(18,18,40,0.10)',
  borderHi: 'rgba(18,18,40,0.18)',

  text: '#13131C',
  textDim: '#54546B',
  textFaint: '#8686A0',

  onAccent: '#FFFFFF',

  accent: '#5B45E8',
  accentSoft: 'rgba(91,69,232,0.12)',

  present: '#0E9B4C',
  presentSoft: 'rgba(14,155,76,0.12)',
  absent: '#D31F42',
  absentSoft: 'rgba(211,31,66,0.12)',
  cancelled: '#6B6B84',
  cancelledSoft: 'rgba(107,107,132,0.12)',

  warn: '#A96A05',
  warnSoft: 'rgba(169,106,5,0.14)',

  track: 'rgba(18,18,40,0.09)',
  trackMark: 'rgba(18,18,40,0.32)',

  cellEmpty: 'rgba(18,18,40,0.022)',
  cellEmptyBorder: 'rgba(18,18,40,0.05)',
  todayTint: 'rgba(91,69,232,0.06)',
};

export type Colors = typeof darkColors;

export type PaletteEntry = { base: string; glow: string; tint: string };

/** Course/slot colours. Tuned for equal weight on a near-black background. */
export const darkPalette: readonly PaletteEntry[] = [
  { base: '#6D5BFF', glow: 'rgba(109,91,255,0.22)', tint: 'rgba(109,91,255,0.12)' }, // indigo
  { base: '#22C7F0', glow: 'rgba(34,199,240,0.22)', tint: 'rgba(34,199,240,0.12)' }, // cyan
  { base: '#2ED573', glow: 'rgba(46,213,115,0.22)', tint: 'rgba(46,213,115,0.12)' }, // green
  { base: '#FFB020', glow: 'rgba(255,176,32,0.22)', tint: 'rgba(255,176,32,0.12)' }, // amber
  { base: '#FF6B9D', glow: 'rgba(255,107,157,0.22)', tint: 'rgba(255,107,157,0.12)' }, // pink
  { base: '#A78BFA', glow: 'rgba(167,139,250,0.22)', tint: 'rgba(167,139,250,0.12)' }, // violet
  { base: '#F97362', glow: 'rgba(249,115,98,0.22)', tint: 'rgba(249,115,98,0.12)' }, // coral
  { base: '#4ADE80', glow: 'rgba(74,222,128,0.22)', tint: 'rgba(74,222,128,0.12)' }, // mint
  { base: '#38BDF8', glow: 'rgba(56,189,248,0.22)', tint: 'rgba(56,189,248,0.12)' }, // sky
  { base: '#FBBF24', glow: 'rgba(251,191,36,0.22)', tint: 'rgba(251,191,36,0.12)' }, // gold
  { base: '#E879F9', glow: 'rgba(232,121,249,0.22)', tint: 'rgba(232,121,249,0.12)' }, // fuchsia
  { base: '#5EEAD4', glow: 'rgba(94,234,212,0.22)', tint: 'rgba(94,234,212,0.12)' }, // teal
];

/**
 * The same twelve hues darkened until each one carries text weight on white.
 * Index order is preserved — a course keeps its identity across a theme switch.
 */
export const lightPalette: readonly PaletteEntry[] = [
  { base: '#4F3CD9', glow: 'rgba(79,60,217,0.18)', tint: 'rgba(79,60,217,0.10)' }, // indigo
  { base: '#0A7FA3', glow: 'rgba(10,127,163,0.18)', tint: 'rgba(10,127,163,0.10)' }, // cyan
  { base: '#0E8C4B', glow: 'rgba(14,140,75,0.18)', tint: 'rgba(14,140,75,0.10)' }, // green
  { base: '#9A6300', glow: 'rgba(154,99,0,0.18)', tint: 'rgba(154,99,0,0.10)' }, // amber
  { base: '#C6296B', glow: 'rgba(198,41,107,0.18)', tint: 'rgba(198,41,107,0.10)' }, // pink
  { base: '#6D42D6', glow: 'rgba(109,66,214,0.18)', tint: 'rgba(109,66,214,0.10)' }, // violet
  { base: '#C2402E', glow: 'rgba(194,64,46,0.18)', tint: 'rgba(194,64,46,0.10)' }, // coral
  { base: '#177F3D', glow: 'rgba(23,127,61,0.18)', tint: 'rgba(23,127,61,0.10)' }, // mint
  { base: '#0D74B8', glow: 'rgba(13,116,184,0.18)', tint: 'rgba(13,116,184,0.10)' }, // sky
  { base: '#8C6100', glow: 'rgba(140,97,0,0.18)', tint: 'rgba(140,97,0,0.10)' }, // gold
  { base: '#A62BB5', glow: 'rgba(166,43,181,0.18)', tint: 'rgba(166,43,181,0.10)' }, // fuchsia
  { base: '#0B7C6E', glow: 'rgba(11,124,110,0.18)', tint: 'rgba(11,124,110,0.10)' }, // teal
];

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

/** Font sizes/weights used across screens; keeps type rhythm consistent. */
export const type = {
  display: { fontSize: 42, fontWeight: '800' as const, letterSpacing: -1.4 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.7 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  /** List-row headline. Sits between h2 and h3 with room to breathe. */
  title: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.35, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '600' as const },
  /** Caps metadata that still has to be readable — `tiny` is for micro-labels. */
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.2 },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;

/** Elevation reads as depth on dark and as a soft lift on light. */
const darkShadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  hero: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
};

const lightShadow: typeof darkShadow = {
  card: {
    shadowColor: '#14142A',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  hero: {
    shadowColor: '#14142A',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

export type Theme = {
  scheme: Scheme;
  colors: Colors;
  palette: readonly PaletteEntry[];
  shadow: typeof darkShadow;
  /** Wraps out-of-range indices, so a colour index can never crash a row. */
  paletteAt: (i: number) => PaletteEntry;
};

function buildTheme(scheme: Scheme): Theme {
  const palette = scheme === 'light' ? lightPalette : darkPalette;
  return {
    scheme,
    colors: scheme === 'light' ? lightColors : darkColors,
    palette,
    shadow: scheme === 'light' ? lightShadow : darkShadow,
    paletteAt: (i) => palette[((i % palette.length) + palette.length) % palette.length],
  };
}

export const themes: Record<Scheme, Theme> = {
  dark: buildTheme('dark'),
  light: buildTheme('light'),
};

/** Colour for an attendance percentage against its threshold. */
export function healthColor(percent: number | null, threshold: number, c: Colors) {
  if (percent == null) return c.textFaint;
  if (percent >= threshold + 8) return c.present;
  if (percent >= threshold) return c.warn;
  return c.absent;
}
