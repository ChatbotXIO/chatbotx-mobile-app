import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  /** Tighter padding and a smaller icon, for short containers such as bottom sheets. */
  compact?: boolean;
}

const ICON_CIRCLE_SIZE = 72;
const ICON_CIRCLE_SIZE_COMPACT = 56;

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  const reducedMotion = useReducedMotion();
  const circleSize = compact ? ICON_CIRCLE_SIZE_COMPACT : ICON_CIRCLE_SIZE;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(280)}
      style={[styles.container, { padding: compact ? spacing.md : spacing.xl, gap: spacing.sm }]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: colors.brandSoft,
          },
        ]}
      >
        <Icon name={icon} size={compact ? 26 : 32} color={colors.brand} />
      </View>
      <Text variant="title" style={styles.centered}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="secondary" style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: spacing.xs }}>
          <Button label={action.label} variant="tonal" onPress={action.onPress} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
