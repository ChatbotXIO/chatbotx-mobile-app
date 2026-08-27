import { forwardRef, useState } from 'react';
import type { TextInput as RNTextInputType } from 'react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { IconButton } from './icon-button';
import type { IconName } from './icon';
import { Text } from './text';

interface TextFieldProps extends React.ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  /** Renders an IconButton inside the field's trailing edge (e.g. a password show/hide toggle).
   * Purely additive to the base field — omit both props for the original single-input layout. */
  trailingIcon?: IconName;
  /** Required when `trailingIcon` is set — forwarded to the inner IconButton's
   * `accessibilityLabel` so the toggle is independently announced by screen readers. */
  trailingIconAccessibilityLabel?: string;
  onTrailingIconPress?: () => void;
}

export const TextField = forwardRef<RNTextInputType, TextFieldProps>(function TextField(
  {
    label,
    error,
    trailingIcon,
    trailingIconAccessibilityLabel,
    onTrailingIconPress,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const { colors, spacing, radius, typography, scheme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="caption" color="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          keyboardAppearance={scheme}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : isFocused ? colors.primary : colors.border,
              borderRadius: radius.md,
              color: colors.text,
              fontSize: typography.body.fontSize,
              paddingHorizontal: spacing.base,
              paddingEnd: trailingIcon ? spacing.xl + spacing.sm : spacing.base,
            },
            style,
          ]}
          {...rest}
        />
        {trailingIcon ? (
          <View style={styles.trailingIcon}>
            <IconButton
              accessibilityLabel={trailingIconAccessibilityLabel ?? ''}
              icon={trailingIcon}
              size="sm"
              variant="ghost"
              onPress={onTrailingIconPress}
            />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    marginStart: 2,
  },
  inputRow: {
    justifyContent: 'center',
  },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trailingIcon: {
    position: 'absolute',
    end: 4,
  },
  error: {
    marginStart: 2,
  },
});
