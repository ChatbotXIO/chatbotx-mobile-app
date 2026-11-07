import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { SwipeAction } from '@/components/ui/swipeable-row';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { Text } from '@/components/ui/text';
import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';
import { ContactStatusStrip } from '@/features/contacts/components/contact-status-icons';
import { contactLastActivityAt, contactSubtitle } from '@/features/contacts/lib/contact-subtitle';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import { useConversationTimeLabel } from '@/features/conversations/components/use-conversation-time-label';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useTheme } from '@/theme/use-theme';

const AVATAR_SIZE = 48;
const ROW_GAP = 12;
const ROW_INSET = 16;

interface ContactRowProps {
  contact: ContactListItem;
  workspaceId: string | null;
  /** Callbacks take the row's `contact` (not pre-bound) so the parent screen can pass one stable
   * `useCallback` per action across every row, instead of a fresh inline closure per item on
   * every render — a fresh closure would defeat `memo` below on every list re-render regardless of
   * whether this row's own data changed. */
  onPress: (contact: ContactListItem) => void;
  onLongPress?: (contact: ContactListItem) => void;
  /** Opens the contact overflow sheet (swipe "More", long-press, accessibility action). */
  onOpenActions?: (contact: ContactListItem) => void;
  /** Jumps to the contact's conversation. Only offered when the contact has one. */
  onMessage?: (contact: ContactListItem) => void;
}

/**
 * PII masking is gated on `usePermissions` — a member without `emailAndPhone` sees masked
 * email/phone here and in info-tab.tsx, not just a decorative blur.
 *
 * Swipe reveals only safe actions (Message, More). Destructive actions (block/delete) live in the
 * overflow sheet, which confirms before acting — a swipe must never delete on its own.
 *
 * The row paints its own opaque background: `SwipeableRow` renders the action panels *behind* the
 * row, so a transparent row lets them show through.
 *
 * Wrapped in `memo` (matching `ConversationRow`) so a list re-render only re-renders rows whose
 * own props actually changed.
 */
export const ContactRow = memo(function ContactRow({
  contact,
  workspaceId,
  onPress,
  onLongPress,
  onOpenActions,
  onMessage,
}: ContactRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const permissions = usePermissions(workspaceId);
  const name = contact.fullName ?? contact.email ?? contact.phoneNumber ?? t('contacts.unknown');
  const subtitle = contactSubtitle(contact, permissions.canSeeEmailAndPhone);
  const timeLabel = useConversationTimeLabel(contactLastActivityAt(contact));
  const channel = contact.contactInboxes?.[0]?.channel;
  const canMessage = Boolean(onMessage && contact.conversation?.id);

  const rightActions: SwipeAction[] | undefined = useMemo(() => {
    const actions: SwipeAction[] = [];
    if (canMessage && onMessage) {
      actions.push({
        icon: 'message-circle',
        label: t('contacts.message'),
        color: colors.brand,
        onPress: () => onMessage(contact),
      });
    }
    if (onOpenActions) {
      actions.push({
        icon: 'ellipsis',
        label: t('contacts.more'),
        color: colors.textSecondary,
        onPress: () => onOpenActions(contact),
      });
    }
    return actions.length > 0 ? actions : undefined;
  }, [canMessage, onMessage, onOpenActions, t, colors.brand, colors.textSecondary, contact]);

  const accessibilityActions = useMemo(
    () => [
      ...(canMessage ? [{ name: 'message', label: t('contacts.message') }] : []),
      ...(onOpenActions ? [{ name: 'openActions', label: t('contacts.actions') }] : []),
    ],
    [canMessage, onOpenActions, t],
  );

  function handleAccessibilityAction(event: { nativeEvent: { actionName: string } }) {
    switch (event.nativeEvent.actionName) {
      case 'message':
        onMessage?.(contact);
        return;
      case 'openActions':
        onOpenActions?.(contact);
        return;
    }
  }

  return (
    <SwipeableRow rightActions={rightActions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[name, subtitle, timeLabel].filter(Boolean).join(', ')}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
        onPress={() => onPress(contact)}
        onLongPress={() => (onLongPress ?? onOpenActions)?.(contact)}
        haptic={false}
        style={[
          styles.row,
          { paddingHorizontal: ROW_INSET, gap: ROW_GAP, backgroundColor: colors.surface1 },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            uri={contact.avatar}
            name={name}
            size={AVATAR_SIZE}
            badge={
              channel ? (
                <ChannelBadge channel={channel} size={14} ringColor={colors.surface1} />
              ) : undefined
            }
          />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text variant="body" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {timeLabel ? (
              <Text variant="caption" color="tertiary" numeric>
                {timeLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.subtitleRow}>
            {subtitle ? (
              <Text variant="caption" color="secondary" numberOfLines={1} style={styles.name}>
                {subtitle}
              </Text>
            ) : (
              <View style={styles.name} />
            )}
            <ContactStatusStrip
              blockedAt={contact.blockedAt}
              tagCount={contact.tags?.length ?? 0}
            />
          </View>
        </View>

        {/* Inset hairline: starts at the text column (iOS/WhatsApp style), not the screen edge. */}
        <View
          pointerEvents="none"
          style={[
            styles.separator,
            { start: ROW_INSET + AVATAR_SIZE + ROW_GAP, backgroundColor: colors.borderSubtle },
          ]}
        />
      </PressableScale>
    </SwipeableRow>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    height: StyleSheet.hairlineWidth,
  },
});

/** FlashList `getItemType` resolver — every row renders the same shape. */
export function contactRowItemType(): string {
  return 'contact-row';
}
