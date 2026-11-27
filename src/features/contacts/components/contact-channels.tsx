import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListItem } from '@/components/ui/list-item';
import { SectionHeader } from '@/components/ui/section-header';
import { useTheme } from '@/theme/use-theme';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import type { ChannelRow } from '@/features/contacts/lib/channel-rows';

const BADGE_SIZE = 20;

interface ContactChannelsProps {
  rows: readonly ChannelRow[];
}

function openProfile(url: string) {
  // On a device with the channel's app installed, the OS hands the link to that app.
  void Linking.openURL(url).catch(() => undefined);
}

/** One row per channel the contact reached us on. A channel with a public profile shows its
 * handle and opens it on press; the rest are display-only. */
export function ContactChannels({ rows }: ContactChannelsProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  if (rows.length === 0) return null;

  return (
    // SectionHeader/ListItem carry their own horizontal padding; the header column already pads,
    // so cancel theirs to line up with the sections below.
    <View style={{ alignSelf: 'stretch', marginHorizontal: -spacing.md }}>
      <SectionHeader title={t('contacts.channels')} />
      {rows.map((row) => {
        const { url } = row;
        const subtitle = [row.inboxName, row.detail].filter(Boolean).join(' · ');
        return (
          <ListItem
            key={row.channel}
            title={row.name}
            subtitle={subtitle || undefined}
            leading={<ChannelBadge channel={row.channel} size={BADGE_SIZE} />}
            showChevron={url !== null}
            onPress={url ? () => openProfile(url) : undefined}
          />
        );
      })}
    </View>
  );
}
