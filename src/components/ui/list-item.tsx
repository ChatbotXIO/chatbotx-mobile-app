import type { PropsWithChildren, ReactNode } from 'react';
import type { AccessibilityState } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { alphaTokens, withAlpha } from '@/theme/color-utils';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

interface ListItemProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  /** Renders title in the danger color and skips the scale-press haptic escalation — for
   * destructive actions (delete, remove, leave). */
  destructive?: boolean;
  /** Right-aligned secondary text shown before `trailing` (e.g. a current value/setting). */
  value?: string;
  disabled?: boolean;
  /** Extra accessibility state merged with `{ disabled }` (e.g. `{ selected: true }` for a row in
   * a single-select list like the workspace picker). */
  accessibilityState?: AccessibilityState;
}

const MIN_HEIGHT = 52;

/** Generic row: leading slot (avatar/icon), title/subtitle, trailing slot. Used for settings rows,
 * contact rows, member rows — anywhere the row is press-to-navigate. */
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  showChevron = false,
  destructive = false,
  value,
  disabled = false,
  accessibilityState,
  children,
}: ListItemProps) {
  const { colors, spacing } = useTheme();
  const reducedMotion = useReducedMotion();
  const overlayOpacity = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const content = (
    <View style={styles.stack}>
      <View
        style={[
          styles.row,
          {
            minHeight: MIN_HEIGHT,
            paddingVertical: spacing.ms,
            paddingHorizontal: spacing.md,
            gap: spacing.ms,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {leading}
        <View style={styles.body}>
          <Text variant="body" numberOfLines={1} color={destructive ? 'danger' : 'primary'}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {children}
        </View>
        {value ? (
          <Text variant="callout" color="secondary" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {trailing}
        {showChevron ? (
          <Icon name="chevron-forward" size={18} color={colors.textSecondary} flipRTL />
        ) : null}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlay,
          { backgroundColor: withAlpha(colors.textPrimary, alphaTokens.pressed) },
          overlayStyle,
        ]}
      />
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      haptic={disabled ? false : destructive ? 'medium' : 'light'}
      onPress={onPress}
      onPressIn={() => {
        // reanimated `SharedValue.value` is a mutable UI-thread ref, not React state — see
        // pressable-scale.tsx for the fuller explanation of this lint false-positive.
        // eslint-disable-next-line react-hooks/immutability
        overlayOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: 100 });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- see onPressIn above.
        overlayOpacity.value = reducedMotion ? 0 : withTiming(0, { duration: 150 });
      }}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
