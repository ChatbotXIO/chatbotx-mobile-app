import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const PULSE_DURATION_MS = 800;

/** Pulsing placeholder block for loading states. Compositor-friendly (opacity only). */
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.7;
      return undefined;
    }
    opacity.value = withRepeat(
      withTiming(1, { duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.surface2 },
        animatedStyle,
        style,
      ]}
    />
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  body: {
    flex: 1,
    gap: 6,
  },
});

/** Loading-state row shaped like a conversation list row: avatar circle + two lines of text +
 * a small trailing meta block. Used by the inbox skeleton list (Phase 3). */
function ConversationRow() {
  return (
    <View style={rowStyles.row}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={rowStyles.body}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="90%" height={13} />
      </View>
      <Skeleton width={32} height={11} />
    </View>
  );
}

/** Loading-state row shaped like a contact list row: avatar circle + name + subtitle line. */
function ContactRow() {
  return (
    <View style={rowStyles.row}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={rowStyles.body}>
        <Skeleton width="50%" height={16} />
        <Skeleton width="70%" height={13} />
      </View>
    </View>
  );
}

/** Loading-state placeholder for a single chat message bubble — a rounded block roughly the size
 * of a short/medium message. `align` picks which side it renders on. */
function MessageRow({ align = 'start' }: { align?: 'start' | 'end' }) {
  return (
    <View style={[rowStyles.row, { justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }]}>
      <Skeleton width={align === 'end' ? '45%' : '60%'} height={40} borderRadius={18} />
    </View>
  );
}

/** Preset loading-row shapes for the three list contexts that need skeleton placeholders:
 * conversations, contacts, and chat messages. Generic enough for Phase 3/4/5 list screens to
 * `.map()` a handful of these while data loads. */
export const SkeletonRow = {
  Conversation: ConversationRow,
  Contact: ContactRow,
  Message: MessageRow,
};
