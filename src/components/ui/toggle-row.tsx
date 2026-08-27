import { StyleSheet, Switch, View } from 'react-native';

import { triggerHaptic } from '@/lib/haptics';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({ label, description, value, onValueChange, disabled }: ToggleRowProps) {
  const { colors, spacing } = useTheme();

  function handleChange(next: boolean) {
    triggerHaptic('selection');
    onValueChange(next);
  }

  return (
    <View style={[styles.row, { paddingVertical: spacing.ms, paddingHorizontal: spacing.md }]}>
      <View style={styles.body}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    gap: 2,
    marginEnd: 12,
  },
});
