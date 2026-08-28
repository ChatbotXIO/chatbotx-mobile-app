import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { colorTokens } from './tokens';
import type { ResolvedScheme } from './use-theme';

/** Feeds our design tokens into react-navigation's ThemeProvider so headers, tab bars, and
 * native-stack chrome match the app's palette instead of react-navigation's defaults. */
export function getNavigationTheme(scheme: ResolvedScheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = colorTokens[scheme];

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.brand,
      background: colors.bg,
      card: colors.surface1,
      text: colors.textPrimary,
      border: colors.borderSubtle,
      notification: colors.danger,
    },
  };
}
