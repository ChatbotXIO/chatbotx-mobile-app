import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useConnectionStatusLabel } from '@/realtime/use-connection-status-label';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface ConnectionTitleProps {
  title: string;
  variant?: 'display' | 'heading' | 'title' | 'subtitle';
}

/** Telegram/WhatsApp-style title slot: shows `title` while connected and swaps to a spinner plus
 * status text while the connection is degraded (after a grace period, see
 * `useConnectionPresentation`). Fades in on swap (instant with reduced motion) and announces
 * changes politely to screen readers. */
export function ConnectionTitle({ title, variant = 'heading' }: ConnectionTitleProps) {
  const statusLabel = useConnectionStatusLabel();
  const { colors, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const entering = reducedMotion ? undefined : FadeIn.duration(motion.durations.base);

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      {statusLabel ? (
        <Animated.View key="status" entering={entering} style={styles.status}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text variant={variant} color="secondary" numberOfLines={1} style={styles.text}>
            {statusLabel}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View key="title" entering={entering}>
          <Text variant={variant} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flexShrink: 1,
  },
});
