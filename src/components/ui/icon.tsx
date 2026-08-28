import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { I18nManager } from 'react-native';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  /** Mirror this icon horizontally in RTL layouts (chevrons, send arrow, etc). `I18nManager.isRTL`
   * only changes on app reload, so reading it at render time is safe — no live-toggle case exists. */
  flipRTL?: boolean;
}

/** Single wrapper around the icon set in use (Ionicons) so swapping icon libraries later touches
 * one file instead of every call site. */
export function Icon({ name, size = 24, color, flipRTL = false }: IconProps) {
  const style = flipRTL && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
