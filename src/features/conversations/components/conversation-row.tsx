import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { SwipeAction } from '@/components/ui/swipeable-row';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { Text } from '@/components/ui/text';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { describeConversationPreview } from '@/features/conversations/lib/conversation-preview';
import { botState, isUnread } from '@/features/conversations/lib/conversation-status';
import { useTheme } from '@/theme/use-theme';

import { ChannelBadge } from './channel-badge';
import { ConversationPreviewLine, previewText } from './conversation-preview-line';
import { AssigneeBadge, StatusIconStrip } from './status-icons';
import { useConversationTimeLabel } from './use-conversation-time-label';
import { WaitingChip } from './waiting-chip';

const AVATAR_SIZE = 54;
const ROW_GAP = 12;
const ROW_INSET = 16;

interface ConversationRowProps {
  conversation: ConversationListItem;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleRead?: () => void;
  onToggleBot?: () => void;
  onArchive?: () => void;
  onOpenActions?: () => void;
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
  const { colors } = useTheme();
  const contactName = conversation.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation.contactInboxes[0]?.channel ?? 'omnichannel';
  const unread = isUnread(conversation);
  const isArchived = Boolean(conversation.archivedAt);
  const bot = botState(conversation.botEnabled, conversation.botResumeAt);
  const botActive = bot === 'on';
  const timeLabel = useConversationTimeLabel(conversation.lastActivityAt);
  const previewDescription = describeConversationPreview(conversation);
  const previewA11y = previewText(previewDescription, t);

  const accessibilityLabel = [
    contactName,
    channel,
    unread ? t('conversations.a11yUnread') : null,
    previewA11y || null,
    timeLabel || null,
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
            label: botActive ? t('conversations.disableBot') : t('conversations.enableBot'),
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
          { paddingHorizontal: ROW_INSET, gap: ROW_GAP, backgroundColor: colors.surface1 },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            uri={conversation.contact?.avatar}
            name={contactName}
            size={AVATAR_SIZE}
            badge={<ChannelBadge channel={channel} size={14} ringColor={colors.surface1} />}
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
            <StatusIconStrip
              followed={conversation.followed}
              archivedAt={conversation.archivedAt}
              blockedAt={conversation.contact?.blockedAt}
              unread={false}
              size={12}
            />
            {timeLabel ? (
              <Text variant="caption" color={unread ? 'brand' : 'tertiary'} numeric>
                {timeLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.previewRow}>
            <ConversationPreviewLine
              messages={conversation.messages}
              unread={unread}
              botState={bot}
            />
            {conversation.awaitingHumanReplySince ? (
              <WaitingChip
                since={conversation.awaitingHumanReplySince}
                slaBreachingAt={conversation.responseSlaBreachingAt}
              />
            ) : null}
            {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} /> : null}
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
    minHeight: 76,
    paddingVertical: 10,
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
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    height: StyleSheet.hairlineWidth,
  },
});

/** FlashList `getItemType` resolver — every row renders the same shape today, so a single
 * constant type is correct; kept as a named export so the parent screen's FlashList can wire it
 * without guessing at a magic string. */
export function conversationRowItemType(): string {
  return 'conversation-row';
}
