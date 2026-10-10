import * as SystemUI from 'expo-system-ui';
import React from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from './store';
import { themes, type Scheme, type Theme } from './theme';

const ThemeContext = React.createContext<Theme>(themes.dark);

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

/** Shorthand for the common case of only needing colours. */
export function useColors() {
  return React.useContext(ThemeContext).colors;
}

type StyleFactory<T> = (t: Theme) => T;

/**
 * Per-factory, per-scheme cache of built stylesheets.
 *
 * `StyleSheet.create` is only cheap if it happens once. Keying a WeakMap on the
 * factory function (which is a module-level constant in every screen) means
 * each screen builds at most two stylesheets for the whole life of the app,
 * regardless of how many rows mount.
 */
const styleCache = new WeakMap<StyleFactory<unknown>, Partial<Record<Scheme, unknown>>>();

/**
 * The factory is expected to call `StyleSheet.create` itself — that keeps
 * TypeScript inferring `flexDirection: 'row'` as the literal rather than
 * widening it to `string`, which no style type accepts.
 */
export function useThemedStyles<T>(factory: StyleFactory<T>): T {
  const theme = useTheme();

  let perScheme = styleCache.get(factory as StyleFactory<unknown>);
  if (!perScheme) {
    perScheme = {};
    styleCache.set(factory as StyleFactory<unknown>, perScheme);
  }
  if (!perScheme[theme.scheme]) {
    perScheme[theme.scheme] = factory(theme);
  }
  return perScheme[theme.scheme] as T;
}

/**
 * Resolves the preference against the OS setting and paints the window behind
 * the React tree, so the gap revealed by an overscroll or a screen transition
 * is never the wrong colour.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useStore((s) => s.settings.themePref);
  const system = useColorScheme();

  const scheme: Scheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
  const theme = themes[scheme];

  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => {
      /* cosmetic only — never worth failing a render over */
    });
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
