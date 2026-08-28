import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Tone = 'brand' | 'neutral' | 'danger';

interface CountPillProps {
  count: number;
  /** Display cap — counts above this render as `"{max}+"`. Defaults to 99. */
  max?: number;
  tone?: Tone;
}

const DEFAULT_MAX = 99;
const PILL_SIZE = 18;

/** Small numeric pill for unread counts, badge counts, etc. Renders nothing when `count` is 0 or
 * less — callers don't need to guard the render themselves. */
export function CountPill({ count, max = DEFAULT_MAX, tone = 'brand' }: CountPillProps) {
  const { colors } = useTheme();

  if (count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);

  const toneStyle: Record<Tone, { background: string; text: 'onBrand' | 'inverse' }> = {
    brand: { background: colors.brand, text: 'onBrand' },
    neutral: { background: colors.textTertiary, text: 'inverse' },
    danger: { background: colors.danger, text: 'onBrand' },
  };
  const { background, text } = toneStyle[tone];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: background,
          minWidth: PILL_SIZE,
          height: PILL_SIZE,
          borderRadius: PILL_SIZE / 2,
          paddingHorizontal: label.length > 1 ? 5 : 0,
        },
      ]}
    >
      <Text variant="micro" color={text} numeric style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
  },
});
