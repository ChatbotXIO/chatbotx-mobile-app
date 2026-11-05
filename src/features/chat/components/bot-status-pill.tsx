import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

interface BotStatusPillProps {
  active: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

const MIN_TOUCH_TARGET = 44;

/** Header bot indicator: a single labelled pill (dot + text) instead of an icon-only button, so
 * the state reads without decoding an icon. Tapping toggles the bot, as the old icon did. */
export function BotStatusPill({ active, accessibilityLabel, onPress }: BotStatusPillProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const accent = active ? colors.bubbleBotAccent : colors.textSecondary;
  const background = active ? withAlpha(accent, 0.16) : colors.surface0;
  const label = active ? t('chat.botStatusOn') : t('chat.botStatusOff');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[styles.hit, { minHeight: MIN_TOUCH_TARGET }]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: background,
            borderRadius: radius.full,
            paddingHorizontal: spacing.ms,
            paddingVertical: spacing.xs,
            gap: spacing.xs + 1,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text variant="caption" style={{ color: accent, fontWeight: '600' }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
