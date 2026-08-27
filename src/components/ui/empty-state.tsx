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
}

const ICON_CIRCLE_SIZE = 72;

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  action,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(280)}
      style={[styles.container, { padding: spacing.xl, gap: spacing.sm }]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            width: ICON_CIRCLE_SIZE,
            height: ICON_CIRCLE_SIZE,
            borderRadius: ICON_CIRCLE_SIZE / 2,
            backgroundColor: colors.brandSoft,
          },
        ]}
      >
        <Icon name={icon} size={32} color={colors.brand} />
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
