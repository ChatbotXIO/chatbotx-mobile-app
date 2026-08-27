import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { IconButton } from './icon-button';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Tone = 'neutral' | 'brand' | 'custom';
type Size = 'sm' | 'md';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  leading?: IconName | ReactNode;
  tone?: Tone;
  /** Base color for `tone="custom"` (e.g. a channel or tag color). Ignored for other tones. */
  color?: string;
  size?: Size;
  disabled?: boolean;
}

const SIZE_PADDING: Record<Size, number> = { sm: 6, md: 8 };
const ICON_SIZE: Record<Size, number> = { sm: 12, md: 14 };

/** Filter/tag chip: selectable pill with an optional leading icon and optional remove (x)
 * button. Selection state is exposed to assistive tech via `accessibilityState`, and selecting
 * fires a light 'selection' haptic. */
export function Chip({
  label,
  selected = false,
  onPress,
  onRemove,
  leading,
  tone = 'neutral',
  color,
  size = 'md',
  disabled = false,
}: ChipProps) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();

  const baseColor =
    tone === 'brand'
      ? colors.brand
      : tone === 'custom'
        ? (color ?? colors.brand)
        : colors.textSecondary;

  const backgroundColor = selected ? withAlpha(baseColor, 0.16) : colors.surface1;
  const borderColor = selected ? withAlpha(baseColor, 0.4) : colors.borderSubtle;
  const textColorStyle = selected ? baseColor : colors.textSecondary;

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          borderRadius: radius.full,
          paddingVertical: SIZE_PADDING[size],
          paddingStart: spacing.ms,
          paddingEnd: onRemove ? spacing.xs : spacing.ms,
          gap: spacing.xs,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {typeof leading === 'string' ? (
        <Icon name={leading as IconName} size={ICON_SIZE[size]} color={textColorStyle} />
      ) : (
        leading
      )}
      <Text variant="caption" numeric style={{ color: textColorStyle, fontWeight: '600' }}>
        {label}
      </Text>
      {onRemove ? (
        <IconButton
          accessibilityLabel={t('common.removeItem', { defaultValue: 'Remove {{label}}', label })}
          icon="close"
          size="sm"
          variant="ghost"
          tint={textColorStyle}
          haptic={false}
          disabled={disabled}
          onPress={onRemove}
          style={styles.removeButton}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      haptic={disabled ? false : 'selection'}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  removeButton: {
    width: 20,
    height: 20,
  },
});
