import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { IconButton } from './icon-button';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius, scheme } = useTheme();

  return (
    <View
      accessibilityRole="search"
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.ms,
          gap: spacing.xs,
        },
      ]}
    >
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { color: colors.text }]}
        returnKeyType="search"
        autoCorrect={false}
        keyboardAppearance={scheme}
      />
      {value.length > 0 ? (
        <IconButton
          accessibilityLabel={t('common.clear')}
          icon="close-circle"
          size="sm"
          variant="ghost"
          tint={colors.textSecondary}
          haptic={false}
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
});
