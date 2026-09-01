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

      <Avatar uri={contact.avatar} name={name} size={AVATAR_SIZE} />
      <Text variant="heading" style={styles.centered}>
        {name}
      </Text>

      {uniqueChannels.length > 0 || contact.blockedAt ? (
        <View style={[styles.chipRow, { gap: spacing.xs }]}>
          {uniqueChannels.map((channel) => (
            <ChannelBadge key={channel} channel={channel} size={16} />
          ))}
          {contact.blockedAt ? (
            <View style={[styles.blockedRow, { gap: spacing.xxs }]}>
              <Icon name="user-lock" size={14} color={colors.danger} />
              <Text variant="caption" style={{ color: colors.danger, fontWeight: '600' }}>
                {t('contacts.blocked')}
              </Text>
            </View>
          ) : null}
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

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
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
  centered: {
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
