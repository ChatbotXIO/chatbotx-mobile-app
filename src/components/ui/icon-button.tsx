import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { CountPill } from './count-pill';
import { PressableScale } from './pressable-scale';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'ghost' | 'tonal' | 'filled' | 'outline';

const SIZE_MAP: Record<Size, number> = { sm: 32, md: 40, lg: 48 };
const ICON_SIZE_MAP: Record<Size, number> = { sm: 16, md: 20, lg: 24 };
const MIN_HIT_TARGET = 44;

interface IconButtonProps extends Omit<
  ComponentProps<typeof PressableScale>,
  'style' | 'children'
> {
  /** Required — every icon-only control must be independently labeled for screen readers. There
   * is no default: an icon glyph alone conveys no meaning to VoiceOver/TalkBack. */
  accessibilityLabel: string;
  icon: IconName;
  size?: Size;
  variant?: Variant;
  /** Overrides the icon/border tint. Defaults to a variant-appropriate color from the theme. */
  tint?: string;
  badgeCount?: number;
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the pressable box's size/layout — used by composite primitives (e.g. Chip's
   * inline remove button) that need a smaller box than the `size` presets provide. */
  style?: StyleProp<ViewStyle>;
}

/** Icon-only pressable control. Visual size can be as small as 32pt (`sm`), but `hitSlop` always
 * pads the touch target up to at least 44x44 — the platform-recommended minimum — regardless of
 * the visual box, so small icon buttons stay comfortably tappable. */
export function IconButton({
  accessibilityLabel,
  icon,
  size = 'md',
  variant = 'ghost',
  tint,
  badgeCount,
  loading = false,
  disabled = false,
  haptic,
  style,
  ...rest
}: IconButtonProps) {
  const { colors, radius } = useTheme();
  const boxSize = SIZE_MAP[size];
  const iconSize = ICON_SIZE_MAP[size];
  const isDisabled = disabled || loading;
  const hitSlopValue = Math.max(0, Math.ceil((MIN_HIT_TARGET - boxSize) / 2));

  const resolvedTint = tint ?? colors.textPrimary;

  const variantStyle = (() => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: tint ?? colors.brand,
          iconColor: tint ? resolvedTint : colors.onBrand,
        };
      case 'tonal':
        return { backgroundColor: withAlpha(resolvedTint, 0.14), iconColor: resolvedTint };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          iconColor: resolvedTint,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
        };
      case 'ghost':
      default:
        return { backgroundColor: 'transparent', iconColor: resolvedTint };
    }
  })();

  return (
    <View style={styles.wrapper}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        hitSlop={hitSlopValue}
        haptic={isDisabled ? false : haptic}
        style={[
          styles.base,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: radius.full,
            backgroundColor: variantStyle.backgroundColor,
            borderWidth: 'borderWidth' in variantStyle ? variantStyle.borderWidth : 0,
            borderColor: 'borderColor' in variantStyle ? variantStyle.borderColor : undefined,
            opacity: isDisabled ? 0.4 : 1,
          },
          style,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variantStyle.iconColor} />
        ) : (
          <Icon name={icon} size={iconSize} color={variantStyle.iconColor} flipRTL />
        )}
      </PressableScale>
      {typeof badgeCount === 'number' && badgeCount > 0 ? (
        <View style={styles.badgeAnchor} pointerEvents="none">
          <CountPill count={badgeCount} tone="danger" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAnchor: {
    position: 'absolute',
    top: -4,
    end: -4,
  },
});
