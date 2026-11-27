import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { ContactChannels } from '@/features/contacts/components/contact-channels';
import { getChannelRows } from '@/features/contacts/lib/channel-rows';
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
  /** Opens `ContactActionsSheet` — omitted when the caller has no workspaceId (mirrors
   * `onAssign`'s own gating). */
  onOpenActions?: () => void;
}

/**
 * Block/unblock/delete now surface through `ContactActionsSheet` (see `onOpenActions`) rather
 * than being absent — they're flag-gated with a "Coming soon" badge there until the session-auth
 * backend routes ship (see use-contact-block.ts / use-delete-contact.ts).
 */
export function ContactHeader({
  contact,
  origin,
  channels = [],
  conversationId = null,
  onAssign,
  onOpenActions,
}: ContactHeaderProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const name = contact.fullName ?? contact.email ?? contact.phoneNumber ?? t('contacts.unknown');
  const hasConversation = Boolean(conversationId);
  const channelRows = getChannelRows(contact, channels);
  // The avatar's corner badge only identifies the primary channel; the channel rows below carry
  // the handles and the press-to-open links.
  const primaryChannel = channelRows[0]?.channel;

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
      {onOpenActions ? (
        <View style={styles.actionsAnchor}>
          <IconButton
            accessibilityLabel={t('contacts.actions')}
            icon="ellipsis-vertical"
            variant="ghost"
            onPress={onOpenActions}
          />
        </View>
      ) : null}

      <View style={styles.avatarWrap}>
        <Avatar
          uri={contact.avatar}
          name={name}
          size={AVATAR_SIZE}
          badge={
            primaryChannel ? (
              <ChannelBadge channel={primaryChannel} size={22} ringColor={colors.bg} />
            ) : undefined
          }
        />
      </View>
      <Text variant="heading" style={styles.name} numberOfLines={2} ellipsizeMode="tail">
        {name}
      </Text>
      {contact.blockedAt ? (
        <View style={[styles.blockedRow, { gap: spacing.xxs }]}>
          <Icon name="user-lock" size={14} color={colors.danger} />
          <Text variant="caption" style={{ color: colors.danger, fontWeight: '600' }}>
            {t('contacts.blocked')}
          </Text>
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
          variant="primary"
          icon="message-circle"
          disabled={!hasConversation}
          onPress={handleMessage}
        />
        {onAssign ? (
          <Button
            label={t('contacts.assign')}
            variant="tonal"
            icon="user-plus"
            onPress={onAssign}
          />
        ) : null}
      </View>

      <ContactChannels rows={channelRows} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  actionsAnchor: {
    alignSelf: 'flex-end',
  },
  avatarWrap: {
    // Avatar's own wrapper is `alignSelf: flex-start`; centre it inside the header column.
    alignSelf: 'center',
  },
  name: {
    textAlign: 'center',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
