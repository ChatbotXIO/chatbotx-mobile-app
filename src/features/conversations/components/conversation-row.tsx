import { memo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RelativeTime } from '@/components/ui/relative-time';
import type { SwipeAction } from '@/components/ui/swipeable-row';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { Text } from '@/components/ui/text';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { isUnread } from '@/features/conversations/lib/conversation-status';
import { useTheme } from '@/theme/use-theme';

import { ChannelBadge } from './channel-badge';
import { AssigneeBadge, BotStateIcon, StatusIconStrip } from './status-icons';

interface ConversationRowProps {
  conversation: ConversationListItem;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleRead?: () => void;
  onToggleBot?: () => void;
  onArchive?: () => void;
  onOpenActions?: () => void;
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
  onOpenActions,
}: ConversationRowProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const contactName = conversation.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation.contactInboxes[0]?.channel ?? 'omnichannel';
  const preview = lastMessagePreview(conversation, t);
  const unread = isUnread(conversation);
  const isArchived = Boolean(conversation.archivedAt);
  const relativeTimeLabel = conversation.lastActivityAt
    ? new Date(conversation.lastActivityAt).toLocaleString()
    : '';

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
          icon: unread ? 'mail-open' : 'mail',
          label: unread ? t('conversations.markRead') : t('conversations.markUnread'),
          color: colors.brand,
          onPress: onToggleRead,
        },
      ]
    : undefined;

  const rightActions: SwipeAction[] = [];
  if (onToggleBot) {
    const botActive = conversation.botEnabled;
    rightActions.push({
      icon: botActive ? 'bot' : 'user',
      label: botActive ? t('conversations.disableBot') : t('conversations.enableBot'),
      color: colors.bubbleBotAccent,
      onPress: onToggleBot,
    });
  }
  if (onArchive) {
    rightActions.push({
      icon: isArchived ? 'archive-x' : 'archive',
      label: isArchived ? t('conversations.unarchive') : t('conversations.archive'),
      color: colors.textSecondary,
      destructive: !isArchived,
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
            label: conversation.botEnabled
              ? t('conversations.disableBot')
              : t('conversations.enableBot'),
          },
        ]
      : []),
    ...(onArchive
      ? [
          {
            name: 'archive',
            label: isArchived ? t('conversations.unarchive') : t('conversations.archive'),
          },
        ]
      : []),
    ...(onOpenActions ? [{ name: 'openActions', label: t('conversations.openActions') }] : []),
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
      case 'openActions':
        onOpenActions?.();
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
        onLongPress={onLongPress ?? onOpenActions}
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
            ring={conversation.botEnabled ? 'bot' : 'none'}
            badge={<ChannelBadge channel={channel} size={14} />}
          />
          <View style={styles.assigneeBadgeAnchor} pointerEvents="none">
            <AssigneeBadge
              assignedUser={conversation.assignedUser}
              assignedInboxTeam={conversation.assignedInboxTeam}
            />
          </View>
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
            <BotStateIcon
              botEnabled={conversation.botEnabled}
              botResumeAt={conversation.botResumeAt}
            />
            <StatusIconStrip
              followed={conversation.followed}
              archivedAt={conversation.archivedAt}
              blockedAt={conversation.contact?.blockedAt}
              unread={unread}
            />
          </View>
        </View>

        {onOpenActions ? (
          <IconButton
            accessibilityLabel={t('conversations.openActions')}
            icon="ellipsis-vertical"
            size="sm"
            variant="ghost"
            onPress={onOpenActions}
          />
        ) : null}
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
  assigneeBadgeAnchor: {
    position: 'absolute',
    bottom: -2,
    start: -2,
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
