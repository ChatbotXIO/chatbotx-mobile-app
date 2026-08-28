import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/use-settings-store';

import {
  colorTokens,
  elevationTokens,
  motionDurations,
  pressScale,
  radiusTokens,
  spacingTokens,
  typographyTokens,
} from './tokens';

export type ResolvedScheme = 'light' | 'dark';

/** Resolves the settings-store theme preference against the OS scheme ('system' ⊕ override). */
export function useResolvedScheme(): ResolvedScheme {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const systemScheme = useColorScheme();

  if (themePreference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return themePreference;
}

/** Builds the full resolved theme object for one scheme. Colors/radius/spacing/typography are
 * already fully static per scheme in tokens.ts (soft/alpha variants are precomputed there via
 * `withAlpha`), so this is just an assembly step — but it's a function (not an inline literal) so
 * `THEMES` below can build both variants with one call each. */
function buildTheme(scheme: ResolvedScheme) {
  return {
    scheme,
    colors: colorTokens[scheme],
    spacing: spacingTokens,
    radius: radiusTokens,
    elevation: elevationTokens[scheme],
    typography: typographyTokens,
    motion: {
      durations: motionDurations,
      pressScale,
    },
  };
}

/** Built once at module load — not per render, not per hook call — so `useTheme()` can return a
 * stable reference per scheme instead of a fresh object every render (which would break
 * `useMemo`/`useCallback` dependency arrays keyed on the theme object). */
const THEMES = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
} as const;

export type Theme = (typeof THEMES)[ResolvedScheme];

/** Resolves the full token set for the active scheme. Use this in components instead of
 * importing colorTokens directly, so theme overrides are respected everywhere. Returns the same
 * object reference across renders as long as the resolved scheme doesn't change. */
export function useTheme(): Theme {
  const scheme = useResolvedScheme();

  return THEMES[scheme];
}
