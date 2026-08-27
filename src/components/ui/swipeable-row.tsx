import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { triggerHaptic } from '@/lib/haptics';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
  destructive?: boolean;
}

interface SwipeableRowProps {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeOpen?: (side: 'left' | 'right') => void;
  children: ReactNode;
}

const ACTION_WIDTH = 76;
// Fraction of one action's width past which crossing counts as "revealed" for haptic purposes.
const HAPTIC_PROGRESS_THRESHOLD = 0.9;

function ActionButton({ action, width }: { action: SwipeAction; width: number }) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
      style={[
        styles.action,
        {
          width,
          backgroundColor: action.destructive ? colors.danger : action.color,
          gap: spacing.xxs,
        },
      ]}
    >
      <Icon name={action.icon} size={20} color={colors.onBrand} />
      <Text variant="micro" style={{ color: colors.onBrand, fontWeight: '600' }} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function ActionsPanel({ actions, side }: { actions: SwipeAction[]; side: 'left' | 'right' }) {
  const width = ACTION_WIDTH * actions.length;
  // In RTL, flip which physical side "start" actions render on so they stay at the reading
  // start of the row, matching the swap the plan calls for.
  const isRTL = I18nManager.isRTL;
  const renderSide = isRTL ? (side === 'left' ? 'right' : 'left') : side;

  return (
    <View
      style={[
        styles.actionsPanel,
        { width },
        renderSide === 'left' ? styles.actionsLeft : styles.actionsRight,
      ]}
    >
      {actions.map((action) => (
        <ActionButton key={action.label} action={action} width={ACTION_WIDTH} />
      ))}
    </View>
  );
}

/** Row wrapper with swipe-to-reveal action panels on either edge. Wraps RNGH's
 * `ReanimatedSwipeable`. `leftActions`/`rightActions` are logical (start/end in LTR); when
 * `I18nManager.isRTL` is true, the rendered panel sides swap so "start" actions stay at the
 * visual start of the row. Fires a 'medium' haptic once a swipe crosses the reveal threshold. */
export function SwipeableRow({
  leftActions,
  rightActions,
  onSwipeOpen,
  children,
}: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const hasFiredHapticRef = useRef(false);
  const progressShared = useSharedValue(0);

  const fireHapticOnce = useCallback(() => {
    if (!hasFiredHapticRef.current) {
      hasFiredHapticRef.current = true;
      triggerHaptic('medium');
    }
  }, []);

  const resetHapticGuard = useCallback(() => {
    hasFiredHapticRef.current = false;
  }, []);

  useAnimatedReaction(
    () => progressShared.value,
    (progress, previous) => {
      if (progress >= HAPTIC_PROGRESS_THRESHOLD && (previous ?? 0) < HAPTIC_PROGRESS_THRESHOLD) {
        runOnJS(fireHapticOnce)();
      } else if (
        progress < HAPTIC_PROGRESS_THRESHOLD &&
        (previous ?? 0) >= HAPTIC_PROGRESS_THRESHOLD
      ) {
        runOnJS(resetHapticGuard)();
      }
    },
  );

  const trackProgress = useCallback(
    (progress: SharedValue<number>) => {
      'worklet';
      // reanimated `SharedValue.value` is a mutable UI-thread ref, not React state — see
      // pressable-scale.tsx for the fuller explanation of this lint false-positive.
      // eslint-disable-next-line react-hooks/immutability
      progressShared.value = progress.value;
    },
    [progressShared],
  );

  const renderLeftActions = leftActions?.length
    ? (progress: SharedValue<number>) => {
        trackProgress(progress);
        return <ActionsPanel actions={leftActions} side="left" />;
      }
    : undefined;

  const renderRightActions = rightActions?.length
    ? (progress: SharedValue<number>) => {
        trackProgress(progress);
        return <ActionsPanel actions={rightActions} side="right" />;
      }
    : undefined;

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      renderLeftActions={I18nManager.isRTL ? renderRightActions : renderLeftActions}
      renderRightActions={I18nManager.isRTL ? renderLeftActions : renderRightActions}
      onSwipeableOpen={(direction) => {
        // RNGH reports the physically-rendered side; translate back to logical start/end.
        const logicalSide = I18nManager.isRTL
          ? direction === 'left'
            ? 'right'
            : 'left'
          : direction;
        onSwipeOpen?.(logicalSide);
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsPanel: {
    flexDirection: 'row',
  },
  actionsLeft: {
    justifyContent: 'flex-start',
  },
  actionsRight: {
    justifyContent: 'flex-end',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
