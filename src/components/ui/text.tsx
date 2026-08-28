import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveDisplayFamily } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';
import type { typographyTokens } from '@/theme/tokens';

type Variant = keyof typeof typographyTokens;
type ColorRole =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'brand'
  | 'danger'
  | 'success'
  | 'warning'
  | 'onBrand';

/** Variants whose weight (600/700) qualifies as "chrome" text — these get the Plus Jakarta Sans
 * display family (language permitting); body/callout/caption/micro stay on the system font since
 * they render user-generated content. */
const DISPLAY_FAMILY_VARIANTS: readonly Variant[] = [
  'display',
  'heading',
  'title',
  'subtitle',
  'label',
];

interface TextProps extends ComponentProps<typeof RNText> {
  variant?: Variant;
  color?: ColorRole;
  /** Applies tabular-nums font variant for aligned numeric columns (counts, timestamps). */
  numeric?: boolean;
}

/** Themed text primitive: variant maps to typographyTokens, color maps to a semantic palette
 * role instead of a raw hex value. Display-weight variants resolve a locale-aware display font
 * family; `maxFontSizeMultiplier` is read from the variant token so Dynamic Type scaling stays
 * within a sane cap per text role. */
export function Text({
  variant = 'body',
  color = 'primary',
  numeric = false,
  style,
  ...rest
}: TextProps) {
  const { colors, typography } = useTheme();
  const { i18n } = useTranslation();

  // Hoisted behind useMemo — this component renders on every message/list row, so rebuilding a
  // fresh object every render (to read a single value out of it) was needless per-render churn.
  const colorMap: Record<ColorRole, string> = useMemo(
    () => ({
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      tertiary: colors.textTertiary,
      inverse: colors.textInverse,
      brand: colors.brand,
      danger: colors.danger,
      success: colors.success,
      warning: colors.warning,
      onBrand: colors.onBrand,
    }),
    [colors],
  );

  const token = typography[variant];
  const fontFamily = DISPLAY_FAMILY_VARIANTS.includes(variant)
    ? resolveDisplayFamily(i18n.language, token.fontWeight === '700' ? '700' : '600')
    : undefined;

  return (
    <RNText
      maxFontSizeMultiplier={token.maxFontSizeMultiplier}
      style={[
        styles.base,
        {
          fontSize: token.fontSize,
          lineHeight: token.lineHeight,
          fontWeight: token.fontWeight,
          color: colorMap[color],
          fontFamily,
          textTransform: 'textTransform' in token ? token.textTransform : undefined,
          letterSpacing: 'letterSpacing' in token ? token.letterSpacing : undefined,
          fontVariant: numeric ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
