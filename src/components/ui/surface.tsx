import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import type { radiusTokens, spacingTokens } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface SurfaceProps extends PropsWithChildren {
  /** Which raised surface level to sit on — 0 is the canvas-adjacent level, 1/2 progressively
   * more raised. Defaults to 0 (flush with the canvas). */
  level?: 0 | 1 | 2;
  radius?: keyof typeof radiusTokens;
  bordered?: boolean;
  elevation?: 0 | 1 | 2 | 3;
  padding?: keyof typeof spacingTokens;
  style?: StyleProp<ViewStyle>;
}

const SURFACE_COLOR_KEYS = ['surface0', 'surface1', 'surface2'] as const;

/** Generic raised-surface container: resolves `level` to the matching `surfaceN` token, applies
 * radius/border/elevation/padding from token keys instead of raw values. Use `Card` below for the
 * common bordered-elevated-card shape. */
export function Surface({
  level = 0,
  radius,
  bordered = false,
  elevation = 0,
  padding,
  style,
  children,
}: SurfaceProps) {
  const theme = useTheme();
  const { colors, radius: radiusScale, elevation: elevationScale, spacing } = theme;

  const backgroundColor = colors[SURFACE_COLOR_KEYS[level]];
  const elevationStyle = elevationScale[elevation];

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: radius ? radiusScale[radius] : undefined,
          borderWidth: bordered ? StyleSheet.hairlineWidth : undefined,
          borderColor: bordered ? colors.borderSubtle : undefined,
          padding: padding ? spacing[padding] : undefined,
        },
        elevation > 0 ? elevationStyle : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Preconfigured Surface for the common "card" shape used across rows/panels: level 1, bordered,
 * medium radius, subtle elevation. Any prop can still be overridden by the caller. */
export function Card(props: SurfaceProps) {
  return <Surface level={1} bordered radius="md" elevation={1} {...props} />;
}
