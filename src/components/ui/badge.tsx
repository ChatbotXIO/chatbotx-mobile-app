import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends PropsWithChildren {
  color?: string;
  textColor?: string;
  /** Semantic tone — resolves background/text from the theme's soft tokens. Ignored when an
   * explicit `color`/`textColor` is passed. */
  tone?: Tone;
  /** Numeric count mode: renders `count` (capped at `max`) instead of `children`. */
  count?: number;
  max?: number;
}

const DEFAULT_MAX = 99;

const TONE_TOKENS: Record<
  Tone,
  {
    bgKey: 'brandSoft' | 'surface1' | 'successSoft' | 'warningSoft' | 'dangerSoft' | 'infoSoft';
    textKey: 'brand' | 'textSecondary' | 'success' | 'warning' | 'danger' | 'info';
  }
> = {
  brand: { bgKey: 'brandSoft', textKey: 'brand' },
  neutral: { bgKey: 'surface1', textKey: 'textSecondary' },
  success: { bgKey: 'successSoft', textKey: 'success' },
  warning: { bgKey: 'warningSoft', textKey: 'warning' },
  danger: { bgKey: 'dangerSoft', textKey: 'danger' },
  info: { bgKey: 'infoSoft', textKey: 'info' },
};

/** Generic pill badge. Two modes: pass `children` for a label badge (explicit `color`/`textColor`
 * for semantic use, or `tone` to resolve from theme tokens), or pass `count`/`max` for a numeric
 * count badge (e.g. unread counts) — count above `max` renders as `"{max}+"`. */
export function Badge({ children, color, textColor, tone, count, max = DEFAULT_MAX }: BadgeProps) {
  const { colors, spacing, radius } = useTheme();

  if (typeof count === 'number' && count <= 0 && children === undefined) return null;

  const toneTokens = tone ? TONE_TOKENS[tone] : undefined;
  const backgroundColor = color ?? (toneTokens ? colors[toneTokens.bgKey] : colors.surface);
  const resolvedTextColor = textColor ?? (toneTokens ? colors[toneTokens.textKey] : colors.text);

  const content = typeof count === 'number' ? (count > max ? `${max}+` : String(count)) : children;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderRadius: radius.full,
          paddingHorizontal: spacing.xs + 2,
          paddingVertical: 2,
        },
      ]}
    >
      <Text
        variant="caption"
        numeric={typeof count === 'number'}
        style={{ color: resolvedTextColor, fontWeight: '600' }}
      >
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
});
