import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { triggerHaptic } from '@/lib/haptics';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  const { colors, spacing, radius, motion } = useTheme();
  const reducedMotion = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = containerWidth > 0 ? containerWidth / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    // Mirror the indicator's horizontal position in RTL so it tracks the visually-active segment
    // (flexDirection isn't flipped here, so the logical index must be translated manually).
    const visualIndex = I18nManager.isRTL ? options.length - 1 - activeIndex : activeIndex;
    const targetX = visualIndex * segmentWidth + 2;
    const targetWidth = segmentWidth - 4;

    if (reducedMotion) {
      indicatorX.value = targetX;
      indicatorWidth.value = targetWidth;
    } else {
      indicatorX.value = withTiming(targetX, { duration: motion.durations.base });
      indicatorWidth.value = withTiming(targetWidth, { duration: motion.durations.base });
    }
  }, [
    activeIndex,
    segmentWidth,
    options.length,
    reducedMotion,
    motion.durations.base,
    indicatorX,
    indicatorWidth,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 2 },
      ]}
    >
      {containerWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            {
              backgroundColor: colors.surface1,
              borderRadius: radius.sm + 2,
              top: 2,
              bottom: 2,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              if (option.value !== value) {
                triggerHaptic('selection');
                onChange(option.value);
              }
            }}
            style={[styles.segment, { paddingVertical: spacing.xs + 2, minHeight: 44 }]}
          >
            <Text variant="caption" color={isActive ? 'primary' : 'secondary'} style={styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    start: 0,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  label: {
    fontWeight: '600',
  },
});
