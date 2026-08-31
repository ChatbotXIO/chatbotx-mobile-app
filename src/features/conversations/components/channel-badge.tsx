import { StyleSheet, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/ui/brand-icons';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/theme/use-theme';

type ChannelIcon = { kind: 'brand'; name: BrandIconName } | { kind: 'lucide'; name: IconName };

/** Every contactInbox `channel` string the backend can send (see schema.ts `contactInboxes[].channel`
 * and the list-filter `channel` enum) — wider than `colors.channel`'s keys, so unmapped channels
 * fall back to a neutral color instead of crashing on an undefined lookup. lucide has no
 * brand/logo glyphs, so messenger/instagram/whatsapp/tiktok/telegram/zalo route through
 * `BrandIcon` instead of the `Icon` registry. */
const CHANNEL_ICONS: Record<string, ChannelIcon> = {
  messenger: { kind: 'brand', name: 'messenger' },
  instagram: { kind: 'brand', name: 'instagram' },
  whatsapp: { kind: 'brand', name: 'whatsapp' },
  tiktok: { kind: 'brand', name: 'tiktok' },
  telegram: { kind: 'brand', name: 'telegram' },
  zalo: { kind: 'brand', name: 'zalo' },
  webchat: { kind: 'lucide', name: 'app-window' },
  email: { kind: 'lucide', name: 'mail' },
  smtp: { kind: 'lucide', name: 'mail' },
  sms: { kind: 'lucide', name: 'message-square-text' },
  api: { kind: 'lucide', name: 'webhook' },
  omnichannel: { kind: 'lucide', name: 'globe' },
};

interface ChannelBadgeProps {
  channel: string;
  size?: number;
}

export function ChannelBadge({ channel, size = 16 }: ChannelBadgeProps) {
  const { colors } = useTheme();
  const color = (colors.channel as Record<string, string>)[channel] ?? colors.textSecondary;
  const icon = CHANNEL_ICONS[channel] ?? { kind: 'lucide', name: 'circle' };

  return (
    <View style={[styles.container, { backgroundColor: color, width: size + 6, height: size + 6 }]}>
      {icon.kind === 'brand' ? (
        <BrandIcon name={icon.name} size={size - 4} color={colors.onBrand} />
      ) : (
        <Icon
          name={icon.name}
          size={size - 4}
          color={colors.onBrand}
          filled={icon.name === 'circle'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
