import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/theme/use-theme';

/** Every contactInbox `channel` string the backend can send (see schema.ts `contactInboxes[].channel`
 * and the list-filter `channel` enum) — wider than `colors.channel`'s keys, so unmapped channels
 * fall back to a neutral color instead of crashing on an undefined lookup. */
const CHANNEL_ICONS: Record<string, IconName> = {
  messenger: 'logo-facebook',
  instagram: 'logo-instagram',
  whatsapp: 'logo-whatsapp',
  webchat: 'chatbubble',
  email: 'mail',
  smtp: 'mail',
  sms: 'chatbox',
  zalo: 'chatbubbles',
  telegram: 'paper-plane',
  tiktok: 'logo-tiktok',
  omnichannel: 'apps',
};

interface ChannelBadgeProps {
  channel: string;
  size?: number;
}

export function ChannelBadge({ channel, size = 16 }: ChannelBadgeProps) {
  const { colors } = useTheme();
  const color = (colors.channel as Record<string, string>)[channel] ?? colors.textSecondary;
  const icon = CHANNEL_ICONS[channel] ?? 'ellipse';

  return (
    <View style={[styles.container, { backgroundColor: color, width: size + 6, height: size + 6 }]}>
      <Icon name={icon} size={size - 4} color={colors.primaryForeground} />
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
