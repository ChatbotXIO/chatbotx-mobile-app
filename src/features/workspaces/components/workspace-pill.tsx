import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/use-theme';

interface WorkspacePillProps {
  name: string;
  logo?: string | null;
  onPress: () => void;
}

/** Inbox header affordance: current workspace's avatar + name, tapping opens the workspace
 * switcher sheet. Kept as a small standalone component (rather than inlined in the conversations
 * screen) so Settings' "Switch workspace" row and any future header reuse it identically. */
export function WorkspacePill({ name, logo, onPress }: WorkspacePillProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.surface2,
          borderRadius: radius.full,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.ms,
          gap: spacing.xs,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Avatar uri={logo} name={name} size={24} />
      <Text variant="caption" numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      <Icon name="chevron-down" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: 200,
  },
  name: {
    flexShrink: 1,
  },
});
