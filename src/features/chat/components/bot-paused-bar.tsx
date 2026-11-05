import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

interface BotPausedBarProps {
  resumeAt: string;
  onResume: () => void;
}

/** Shown above the composer while the bot is paused: how long is left and a one-tap resume. */
export function BotPausedBar({ resumeAt, onResume }: BotPausedBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const minutes = Math.max(1, dayjs(resumeAt).diff(dayjs(), 'minute'));

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: withAlpha(colors.warning, 0.14),
          borderRadius: radius.md,
          marginHorizontal: spacing.sm,
          marginTop: spacing.xs,
          paddingStart: spacing.base,
          paddingEnd: spacing.xs,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="caption" style={styles.label}>
        {t('chat.botPausedRemaining', { minutes })}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onResume}
        style={[styles.button, { borderColor: colors.warning, borderRadius: radius.full }]}
      >
        <Text variant="caption" style={{ color: colors.warning, fontWeight: '600' }}>
          {t('chat.resumeBot')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  button: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginVertical: 2,
  },
});
