/**
 * Design tokens. One dark, high-contrast surface set plus a 12-colour course
 * palette. Every course/slot colour comes from `palette` by index so the whole
 * app stays visually coherent no matter what the user names things.
 */

export const colors = {
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
} as const;

/** Course/slot colours. Tuned for equal weight on a near-black background. */
export const palette = [
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
] as const;

export function paletteAt(i: number) {
  return palette[((i % palette.length) + palette.length) % palette.length];
}

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
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '600' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;

export const shadow = {
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
} as const;

/** Colour for an attendance percentage against its threshold. */
export function healthColor(percent: number | null, threshold: number) {
  if (percent == null) return colors.textFaint;
  if (percent >= threshold + 8) return colors.present;
  if (percent >= threshold) return colors.warn;
  return colors.absent;
}
