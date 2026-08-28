import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { type HapticKind, triggerHaptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends ComponentProps<typeof Pressable> {
  /** Scale factor applied on press-in. Defaults to the `pressScale` motion token. */
  scaleTo?: number;
  /** Haptic kind fired on press-in. Pass `false` to suppress. Defaults to `'light'`. */
  haptic?: HapticKind | false;
}

/** Pressable wrapper that scales down on press via reanimated, using the shared `pressScale`
 * token. Respects `useReducedMotion()` — when reduced motion is on, the scale animation is
 * skipped entirely (no transform change) but the haptic still fires, since haptics aren't
 * motion. */
export function PressableScale({
  scaleTo,
  haptic = 'light',
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const { motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const targetScale = scaleTo ?? motion.pressScale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[reducedMotion ? undefined : animatedStyle, style]}
      onPressIn={(event) => {
        if (!reducedMotion) {
          // reanimated `SharedValue.value` is a mutable UI-thread ref by design (not React
          // state); the react-compiler lint rule can't tell it apart from a plain object.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(targetScale, { duration: motion.durations.instant });
        }
        if (haptic) triggerHaptic(haptic);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reducedMotion) {
          // eslint-disable-next-line react-hooks/immutability -- see onPressIn above.
          scale.value = withTiming(1, { duration: motion.durations.fast });
        }
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
