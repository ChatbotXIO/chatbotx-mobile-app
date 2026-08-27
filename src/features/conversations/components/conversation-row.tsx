import { memo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RelativeTime } from '@/components/ui/relative-time';
import type { SwipeAction } from '@/components/ui/swipeable-row';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { Text } from '@/components/ui/text';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { isBotActive, isUnread } from '@/features/conversations/lib/conversation-status';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { ChannelBadge } from './channel-badge';
import type { ConversationStatusChip } from './tag-chips';
import { TagChips } from './tag-chips';

interface ConversationRowProps {
  conversation: ConversationListItem;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleRead?: () => void;
  onToggleBot?: () => void;
  onArchive?: () => void;
}

function lastMessagePreview(conversation: ConversationListItem, t: TFunction): string {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (!lastMessage) return '';
  if (lastMessage.text) return lastMessage.text;
  if (lastMessage.attachmentCount) {
    return t('conversations.attachmentPreview', { count: lastMessage.attachmentCount });
  }
  return '';
}

function statusChips(conversation: ConversationListItem): ConversationStatusChip[] {
  const chips: ConversationStatusChip[] = [];
  if (conversation.followed) chips.push('followUp');
  if (conversation.archivedAt) chips.push('archived');
  if (conversation.contact?.blockedAt) chips.push('blocked');
  return chips;
}

/**
 * Presentational conversation row: renders from `conversation` and calls back to the parent
 * screen for every action — it never calls a mutation hook directly. `onToggleRead`/`onToggleBot`/
 * `onArchive` are optional so this component still renders sensibly in contexts that don't wire
 * swipe actions (e.g. a future preview/gallery use).
 *
 * Swipe: start (left in LTR) reveals a read/unread toggle; end (right in LTR) reveals bot toggle +
 * archive. `SwipeableRow` itself mirrors these for RTL. Archive does not confirm inline — the
 * screen is expected to show an "Archived — Undo" toast (toast+undo is less friction than a modal
 * confirm and is what `onArchive` is wired to in conversations/index.tsx).
 */
export const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
  onLongPress,
  onToggleRead,
  onToggleBot,
  onArchive,
}: ConversationRowProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const contactName = conversation.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation.contactInboxes[0]?.channel ?? 'omnichannel';
  const preview = lastMessagePreview(conversation, t);
  const unread = isUnread(conversation);
  const botActive = isBotActive(conversation.botEnabled, conversation.botResumeAt);
  const botPaused = !conversation.botEnabled && !botActive;
  const assigneeName = conversation.assignedUser?.name;
  const relativeTimeLabel = conversation.lastActivityAt
    ? new Date(conversation.lastActivityAt).toLocaleString()
    : '';

  const chips = statusChips(conversation);

  const accessibilityLabel = [
    contactName,
    channel,
    unread ? t('conversations.a11yUnread') : null,
    preview || null,
    relativeTimeLabel || null,
  ]
    .filter(Boolean)
    .join(', ');

  const leftActions: SwipeAction[] | undefined = onToggleRead
    ? [
        {
          icon: unread ? 'mail-open-outline' : 'mail-unread-outline',
          label: unread ? t('conversations.markRead') : t('conversations.markUnread'),
          color: colors.brand,
          onPress: onToggleRead,
        },
      ]
    : undefined;

  const rightActions: SwipeAction[] = [];
  if (onToggleBot) {
    rightActions.push({
      icon: botActive ? 'sparkles' : 'sparkles-outline',
      label: botActive ? t('conversations.disableBot') : t('conversations.enableBot'),
      color: colors.bubbleBotAccent,
      onPress: onToggleBot,
    });
  }
  if (onArchive) {
    rightActions.push({
      icon: 'archive-outline',
      label: t('conversations.archive'),
      color: colors.textSecondary,
      destructive: true,
      onPress: onArchive,
    });
  }

  const accessibilityActions = [
    ...(onToggleRead
      ? [
          {
            name: 'toggleRead',
            label: unread ? t('conversations.markRead') : t('conversations.markUnread'),
          },
        ]
      : []),
    ...(onToggleBot
      ? [
          {
            name: 'toggleBot',
            label: botActive ? t('conversations.disableBot') : t('conversations.enableBot'),
          },
        ]
      : []),
    ...(onArchive ? [{ name: 'archive', label: t('conversations.archive') }] : []),
  ];

  function handleAccessibilityAction(event: { nativeEvent: { actionName: string } }) {
    switch (event.nativeEvent.actionName) {
      case 'toggleRead':
        onToggleRead?.();
        return;
      case 'toggleBot':
        onToggleBot?.();
        return;
      case 'archive':
        onArchive?.();
        return;
    }
  }

  return (
    <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
        onPress={onPress}
        onLongPress={onLongPress}
        haptic={false}
        style={[
          styles.row,
          {
            paddingVertical: spacing.ms,
            paddingHorizontal: spacing.md,
            gap: spacing.ms,
            backgroundColor: colors.surface1,
          },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            uri={conversation.contact?.avatar}
            name={contactName}
            size={52}
            ring={botActive ? 'bot' : 'none'}
            badge={<ChannelBadge channel={channel} size={14} />}
          />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.name}>
              {contactName}
            </Text>
            {conversation.lastActivityAt ? (
              <RelativeTime date={conversation.lastActivityAt} />
            ) : null}
          </View>
          <View style={styles.previewRow}>
            <Text
              variant="callout"
              color={unread ? 'primary' : 'secondary'}
              numberOfLines={1}
              style={[styles.preview, unread && styles.previewUnread]}
            >
              {preview}
            </Text>
            {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} /> : null}
          </View>

          <View style={[styles.metaRow, { gap: spacing.xs }]}>
            {botActive || botPaused ? (
              <View
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: botPaused
                      ? colors.warningSoft
                      : withAlpha(colors.bubbleBotAccent, 0.16),
                  },
                ]}
              >
                <Text
                  variant="micro"
                  style={{
                    color: botPaused ? colors.warning : colors.bubbleBotAccent,
                    fontWeight: '600',
                  }}
                >
                  {botPaused ? t('conversations.botPaused') : t('conversations.botActive')}
                </Text>
              </View>
            ) : null}
            {assigneeName ? (
              <Text variant="micro" color="tertiary" numberOfLines={1}>
                {t('conversations.assignedTo', { name: assigneeName })}
              </Text>
            ) : null}
          </View>

          <TagChips chips={chips} />
        </View>
      </PressableScale>
    </SwipeableRow>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    position: 'relative',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  preview: {
    flex: 1,
  },
  previewUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

/** FlashList `getItemType` resolver — every row renders the same shape today, so a single
 * constant type is correct; kept as a named export so the parent screen's FlashList can wire it
 * without guessing at a magic string. */
export function conversationRowItemType(): string {
  return 'conversation-row';
}
