import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'tonal';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ComponentProps<typeof PressableScale>, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
}

const SIZE_STYLES: Record<
  Size,
  { minHeight: number; paddingHorizontal: number; textVariant: 'callout' | 'body' | 'subtitle' }
> = {
  sm: { minHeight: 36, paddingHorizontal: 14, textVariant: 'callout' },
  md: { minHeight: 48, paddingHorizontal: 20, textVariant: 'body' },
  lg: { minHeight: 56, paddingHorizontal: 24, textVariant: 'subtitle' },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const isDisabled = disabled || loading;

  // Hoisted behind useMemo — Button renders on every list row/action bar, so rebuilding this
  // object every render (to read a single variant's entry out of it) was needless per-render
  // churn.
  const variantStyles: Record<
    Variant,
    { background: string; text: 'onBrand' | 'primary' | 'danger' | 'brand'; borderColor?: string }
  > = useMemo(
    () => ({
      primary: { background: colors.brand, text: 'onBrand' },
      danger: { background: colors.danger, text: 'onBrand' },
      secondary: {
        background: colors.surface1,
        text: 'primary',
        borderColor: colors.borderStrong,
      },
      tonal: { background: colors.brandSoft, text: 'brand' },
      ghost: { background: 'transparent', text: 'primary' },
    }),
    [colors],
  );
  const { background, text, borderColor } = variantStyles[variant];
  const sizeStyle = SIZE_STYLES[size];

  const iconColor =
    text === 'onBrand'
      ? colors.onBrand
      : text === 'brand'
        ? colors.brand
        : text === 'danger'
          ? colors.danger
          : colors.textPrimary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      haptic={isDisabled ? false : 'light'}
      style={[
        styles.base,
        {
          backgroundColor: background,
          borderRadius: radius.md,
          minHeight: sizeStyle.minHeight,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          gap: spacing.xs + 2,
          opacity: isDisabled ? 0.5 : 1,
          borderWidth: borderColor ? StyleSheet.hairlineWidth : 0,
          borderColor,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? (
            <Icon
              name={icon}
              size={sizeStyle.textVariant === 'subtitle' ? 22 : 18}
              color={iconColor}
            />
          ) : null}
          <Text variant={sizeStyle.textVariant} color={text} style={styles.label}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});
