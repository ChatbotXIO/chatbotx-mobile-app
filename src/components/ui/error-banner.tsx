import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

interface ErrorBannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'danger' | 'warning' | 'info';
}

/** Inline banner for errors and workspace-blocked/quota states. Not a toast — stays mounted until
 * the caller removes it (composer quota banner, list-level fetch error, etc). */
export function ErrorBanner({ message, actionLabel, onAction, tone = 'danger' }: ErrorBannerProps) {
  const { colors, spacing, radius } = useTheme();

  // Hoisted behind useMemo — rebuilding all three tones every render (to read one) was needless
  // per-render churn on a component that can sit mounted for a whole screen's lifetime.
  const toneMap = useMemo(
    () => ({
      danger: { tint: colors.danger, soft: colors.dangerSoft },
      warning: { tint: colors.warning, soft: colors.warningSoft },
      info: { tint: colors.info, soft: colors.infoSoft },
    }),
    [colors],
  );
  const toneTokens = toneMap[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: toneTokens.soft,
          borderRadius: radius.md,
          padding: spacing.ms,
          gap: spacing.xs,
        },
      ]}
    >
      <Icon
        name={tone === 'info' ? 'information-circle' : 'alert-circle'}
        size={18}
        color={toneTokens.tint}
      />
      <Text variant="caption" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
        >
          <Text variant="caption" style={{ color: toneTokens.tint, fontWeight: '700' }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
  },
});
