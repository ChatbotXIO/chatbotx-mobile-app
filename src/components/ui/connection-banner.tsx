import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

export type ConnectionState = 'online' | 'connecting' | 'reconnecting' | 'offline';

interface ConnectionBannerProps {
  state: ConnectionState;
}

const AUTO_HIDE_AFTER_ONLINE_MS = 1200;
const BANNER_HEIGHT = 36;

/** Slide-from-top presentational banner for realtime connection state. Stays visible for any
 * non-'online' state; once state transitions to 'online' it holds briefly (so the "back online"
 * confirmation is readable) then auto-hides. Purely presentational — callers own translating
 * actual socket state into `state`. */
export function ConnectionBanner({ state }: ConnectionBannerProps) {
  const { t } = useTranslation();
  const { colors, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(-BANNER_HEIGHT);
  // Whether we're still holding the banner visible after a transition to 'online', during the
  // brief confirmation window before auto-hiding. Derived synchronously from `state` wherever
  // possible; the one place this must be set imperatively is the hold timer below, which is a
  // deliberate external-timer synchronization (exactly what effects are for), not a disguised
  // derived-state computation — see the inline suppression there.
  const [isHoldingAfterOnline, setIsHoldingAfterOnline] = useState(state === 'online');
  const shouldShow = state !== 'online' || isHoldingAfterOnline;

  useEffect(() => {
    if (state !== 'online') {
      translateY.value = reducedMotion ? 0 : withTiming(0, { duration: motion.durations.base });
      return undefined;
    }

    // Just transitioned to 'online' — hold visible briefly (so the confirmation is readable),
    // then slide away. This synchronizes to a real external timer (setTimeout), which is exactly
    // what effects are for; the lint rule's "avoid setState in an effect body" heuristic doesn't
    // have a way to distinguish that from disguised derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHoldingAfterOnline(true);
    const timer = setTimeout(() => {
      translateY.value = reducedMotion
        ? -BANNER_HEIGHT
        : withTiming(-BANNER_HEIGHT, { duration: motion.durations.base });
      setIsHoldingAfterOnline(false);
    }, AUTO_HIDE_AFTER_ONLINE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `translateY` is a stable shared-value ref.
  }, [state, motion.durations.base, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const config: Record<
    ConnectionState,
    {
      icon: 'cloud-offline-outline' | 'sync-outline' | 'checkmark-circle-outline';
      background: string;
      textColor: string;
      label: string;
    }
  > = {
    online: {
      icon: 'checkmark-circle-outline',
      background: colors.successSoft,
      textColor: colors.success,
      label: t('realtime.online', { defaultValue: 'Back online' }),
    },
    connecting: {
      icon: 'sync-outline',
      background: colors.infoSoft,
      textColor: colors.info,
      label: t('realtime.connecting', { defaultValue: 'Connecting…' }),
    },
    reconnecting: {
      icon: 'sync-outline',
      background: colors.warningSoft,
      textColor: colors.warning,
      label: t('realtime.reconnecting', { defaultValue: 'Reconnecting…' }),
    },
    offline: {
      icon: 'cloud-offline-outline',
      background: colors.dangerSoft,
      textColor: colors.danger,
      label: t('realtime.offline', { defaultValue: "You're offline" }),
    },
  };
  const { icon, background, textColor, label } = config[state];

  if (!shouldShow) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.container,
        { height: BANNER_HEIGHT, backgroundColor: background },
        reducedMotion ? undefined : animatedStyle,
      ]}
    >
      <Icon name={icon} size={16} color={textColor} />
      <Text variant="caption" style={{ color: textColor, fontWeight: '600' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
});
