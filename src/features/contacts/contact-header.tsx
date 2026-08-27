import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { useTheme } from '@/theme/use-theme';

const AVATAR_SIZE = 88;

export type ContactPanelOrigin = 'conversation' | 'directory';

interface ContactHeaderProps {
  contact: ContactDetail;
  /** Which route opened this panel — 'conversation' when reached from a conversation's own
   * contact tab (the conversation is already the one "Message" would navigate to, so it goes
   * back instead of forward), 'directory' when reached from the standalone contacts tab (in
   * which case "Message" pushes to the contact's conversation). */
  origin: ContactPanelOrigin;
  /** The contact's channel identifiers (e.g. `['whatsapp', 'email']`), for the channel chip row.
   * `useContactDetail`'s response doesn't embed `contactInboxes` (only the contacts-LIST
   * endpoints do — see find-contact-in-cache.ts) so the caller sources this from whichever list
   * cache is available; omitted/empty renders no chips. */
  channels?: string[];
  /** The contact's active conversation id, if any — sourced the same way as `channels` (not
   * present on the contact-detail response). Drives the "Message" CTA; the button is disabled
   * when this is null/undefined. */
  conversationId?: string | null;
  onAssign?: () => void;
}

/**
 * No block/unblock action here: `contactsAPIs.blockContactAuthenticatedAPI` doesn't exist in the
 * generated schema — only `blockContactWorkspaceTokenAPI`/`unblockContactWorkspaceTokenAPI` do,
 * which require workspace-token auth, not the bearer/session auth this app uses throughout. The
 * header shows the current blocked state (read from `blockedAt`, kept live via the realtime
 * contactBlocked/contactUnblocked appliers) but can't toggle it from mobile.
 */
export function ContactHeader({
  contact,
  origin,
  channels = [],
  conversationId = null,
  onAssign,
}: ContactHeaderProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const name = contact.fullName ?? contact.email ?? contact.phoneNumber ?? t('contacts.unknown');
  const uniqueChannels = Array.from(new Set(channels));

  const hasConversation = Boolean(conversationId);

  function handleMessage() {
    if (!conversationId) return;
    if (origin === 'conversation') {
      router.back();
      return;
    }
    router.push(`/(app)/conversations/${conversationId}`);
  }

  return (
    <View style={[styles.container, { padding: spacing.lg, gap: spacing.sm }]}>
      <Avatar uri={contact.avatar} name={name} size={AVATAR_SIZE} />
      <Text variant="heading" style={styles.centered}>
        {name}
      </Text>

      {uniqueChannels.length > 0 || contact.blockedAt ? (
        <View style={[styles.chipRow, { gap: spacing.xs }]}>
          {uniqueChannels.map((channel) => (
            <ChannelBadge key={channel} channel={channel} size={16} />
          ))}
          {contact.blockedAt ? <Badge tone="danger">{t('contacts.blocked')}</Badge> : null}
        </View>
      ) : null}

      {contact.email ? (
        <Text variant="body" color="secondary">
          {contact.email}
        </Text>
      ) : null}
      {contact.phoneNumber ? (
        <Text variant="body" color="secondary">
          {contact.phoneNumber}
        </Text>
      ) : null}

      <View style={[styles.ctaRow, { gap: spacing.sm, marginTop: spacing.xs }]}>
        <Button
          label={t('contacts.message')}
          variant="tonal"
          icon="chatbubble-outline"
          disabled={!hasConversation}
          onPress={handleMessage}
        />
        {onAssign ? (
          <Button
            label={t('contacts.assign')}
            variant="tonal"
            icon="person-add-outline"
            onPress={onAssign}
          />
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 8,
  },
});
