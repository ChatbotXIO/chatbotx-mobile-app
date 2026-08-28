import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Ring = 'none' | 'online' | 'bot';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /** Slot anchored bottom-end (channel icon, status dot). Absolutely positioned over the avatar. */
  badge?: ReactNode;
  /** Colored ring around the avatar: 'online' (success) or 'bot' (violet accent). */
  ring?: Ring;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Deterministic hash of a string into a small non-negative int — used to pick a stable
 * avatar-palette index per name/id, so the same contact always gets the same fallback tint. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // deliberate 32-bit hash mixing
  }
  return Math.abs(hash);
}

export function Avatar({ uri, name, size = 40, badge, ring = 'none' }: AvatarProps) {
  const { colors } = useTheme();
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };
  const ringColor =
    ring === 'online' ? colors.success : ring === 'bot' ? colors.bubbleBotAccent : undefined;
  const ringWidth = size < 32 ? 1.5 : 2;

  const paletteIndex = hashString(name) % colors.avatarPalette.length;
  const fallbackColor = colors.avatarPalette[paletteIndex]!;

  const core = uri ? (
    <Image
      source={{ uri }}
      style={[dimensionStyle, { backgroundColor: withAlpha(colors.textPrimary, 0.06) }]}
      contentFit="cover"
      transition={150}
    />
  ) : (
    <View style={[styles.fallback, dimensionStyle, { backgroundColor: fallbackColor }]}>
      <Text variant="caption" color="primary" style={{ fontSize: size * 0.4, fontWeight: '700' }}>
        {initialsFor(name)}
      </Text>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View
        style={
          ringColor
            ? [
                styles.ring,
                {
                  width: size + ringWidth * 2,
                  height: size + ringWidth * 2,
                  borderRadius: (size + ringWidth * 2) / 2,
                  borderWidth: ringWidth,
                  borderColor: ringColor,
                },
              ]
            : undefined
        }
      >
        {core}
      </View>
      {badge ? (
        <View style={styles.badgeAnchor} pointerEvents="none">
          {badge}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAnchor: {
    position: 'absolute',
    bottom: -2,
    end: -2,
  },
});
