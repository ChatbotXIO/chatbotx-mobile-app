import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { describeConversationPreview } from '@/features/conversations/lib/conversation-preview';
import { botState, isUnread } from '@/features/conversations/lib/conversation-status';
import { triggerHaptic } from '@/lib/haptics';
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
  /** Opens the conversation actions sheet (⋯ button, long-press fallback, accessibility action). */
  onOpenActions?: () => void;
}

/**
 * Presentational conversation row: renders from `conversation` and calls back to the parent
 * screen for every action — it never calls a mutation hook directly. Row actions (read/unread, bot
 * toggle, archive, assign) live in the screen's actions sheet, opened by long-press, the ⋯ button,
 * or the `openActions` accessibility action.
 */
export const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
  onLongPress,
  onOpenActions,
}: ConversationRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const contactName = conversation.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation.contactInboxes[0]?.channel ?? 'omnichannel';
  const unread = isUnread(conversation);
  const bot = botState(conversation.botEnabled, conversation.botResumeAt);
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

  const accessibilityActions = onOpenActions
    ? [{ name: 'openActions', label: t('conversations.openActions') }]
    : [];

  function handleAccessibilityAction(event: { nativeEvent: { actionName: string } }) {
    if (event.nativeEvent.actionName === 'openActions') {
      onOpenActions?.();
    }
  }

  const longPressAction = onLongPress ?? onOpenActions;
  const handleLongPress = longPressAction
    ? () => {
        triggerHaptic('medium');
        longPressAction();
      }
    : undefined;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
      onPress={onPress}
      onLongPress={handleLongPress}
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
