import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
      ]}
    >
      <Text variant="caption" color="secondary" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      {action ? (
        <Text variant="caption" color="secondary" onPress={action.onPress}>
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
