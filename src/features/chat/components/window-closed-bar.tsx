import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

interface WindowClosedBarProps {
  channel: string | null;
  onSendFlow: () => void;
}

function bannerKey(channel: string | null): string {
  switch (channel) {
    case 'messenger':
    case 'instagram':
      return 'chat.windowClosedBannerMeta';
    case 'tiktok':
      return 'chat.windowClosedBannerTiktok';
    default:
      return 'chat.windowClosedBanner';
  }
}

/** Replaces the text input once the channel's customer-service window has closed: explains why and
 * offers the one action the channel still allows (sending a flow/template). */
export function WindowClosedBar({ channel, onSendFlow }: WindowClosedBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  return (
    <View>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: withAlpha(colors.warning, 0.14),
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.base,
            gap: spacing.base,
          },
        ]}
      >
        <Icon name="clock" size={18} color={colors.warning} />
        <Text variant="caption" style={styles.bannerText}>
          {t(bannerKey(channel))}
        </Text>
      </View>
      <View style={{ padding: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          onPress={onSendFlow}
          style={[styles.action, { backgroundColor: colors.brand, borderRadius: radius.full }]}
        >
          <Text variant="bodyStrong" color="onBrand">
            {t('chat.sendFlow')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerText: { flex: 1 },
  action: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
