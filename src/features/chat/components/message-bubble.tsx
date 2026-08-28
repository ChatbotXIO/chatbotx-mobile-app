import dayjs from 'dayjs';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import type { GroupPosition } from '@/features/chat/lib/message-groups';
import { useTheme } from '@/theme/use-theme';

import { ActivityMessage } from './activity-message';
import { AttachmentView } from './attachment-view';
import { LocationView } from './location-view';
import { getOptimisticStatus } from './optimistic-message';
import { RichContentView } from './rich-content-view';

type SenderVariant = 'contact' | 'agent' | 'bot' | 'system';

interface MessageBubbleProps {
  message: Message;
  position: GroupPosition;
  showMeta: boolean;
  /** Lookup for resolving `parentId` into the quoted reply preview — built once by MessageList
   * from the full loaded message set, not refetched per bubble. */
  messagesById: Map<string, Message>;
  onLongPress?: () => void;
  onRetry?: () => void;
}

/** senderType 'contact' is inbound (left); 'bot' gets its own violet-tinted variant; 'system' is a
 * centered activity chip, not a side bubble; everything else ('user'/'api') is a regular outbound
 * agent bubble. There's no dedicated `isOutbound` field on the schema, so this is derived from
 * senderType instead. */
function senderVariant(message: Message): SenderVariant {
  if (message.senderType === 'contact') return 'contact';
  if (message.senderType === 'bot') return 'bot';
  if (message.senderType === 'system') return 'system';
  return 'agent';
}

function formatTime(date: string): string {
  return dayjs(date).format('HH:mm');
}

function MessageBubbleImpl({
  message,
  position,
  showMeta,
  messagesById,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  if (message.messageType === 'activity') {
    return <ActivityMessage message={message} />;
  }

  const variant = senderVariant(message);

  if (variant === 'system') {
    return <ActivityMessage message={message} />;
  }

  const outbound = variant !== 'contact';
  const optimistic = getOptimisticStatus(message);
  const isDeleted = Boolean(message.deletedAt);
  // Defensive: this component renders whatever is in the query cache, which realtime events also
  // write into. A payload missing `attachments` should degrade, not white-screen the chat.
  const attachments = message.attachments ?? [];

  const bubbleColor =
    variant === 'bot' ? colors.bubbleBot : outbound ? colors.bubbleOut : colors.bubbleIn;
  const textColor =
    variant === 'bot'
      ? colors.bubbleBotText
      : outbound
        ? colors.bubbleOutText
        : colors.bubbleInText;

  // Tails (asymmetric corner radius) only render on the terminal bubble of a group — grouped
  // bubbles in the middle stay fully rounded on the "inner" side to visually chain together.
  const isGroupEnd = position === 'single' || position === 'last';
  const cornerStyle = outbound
    ? { borderBottomEndRadius: isGroupEnd ? radius.xs : radius.bubble }
    : { borderBottomStartRadius: isGroupEnd ? radius.xs : radius.bubble };

  const parent = message.parentId ? messagesById.get(message.parentId) : undefined;
  const hasReply = Boolean(message.parentId);

  const timeLabel = formatTime(message.createdAt);
  const statusLabel =
    optimistic?.status === 'failed'
      ? t('chat.status.failed')
      : optimistic?.status === 'pending'
        ? t('chat.status.pending')
        : t('chat.status.sent');
  const senderLabel =
    variant === 'bot'
      ? t('chat.senderBot')
      : variant === 'agent'
        ? t('chat.senderAgent')
        : t('chat.senderContact');
  const bubbleText = isDeleted ? t('chat.messageDeleted') : (message.text ?? '');

  const accessibilityLabel = t('chat.bubbleA11yLabel', {
    sender: senderLabel,
    text: bubbleText,
    time: timeLabel,
    status: statusLabel,
  });

  return (
    <View
      style={[
        styles.row,
        outbound ? styles.rowOutbound : styles.rowInbound,
        { marginTop: showMeta ? spacing.sm : spacing.xxs },
      ]}
    >
      {variant === 'bot' && showMeta ? (
        <Text
          variant="micro"
          style={[styles.botLabel, { color: colors.bubbleBotAccent, marginStart: spacing.xs }]}
        >
          {t('chat.senderBot')}
        </Text>
      ) : null}

      <Pressable
        accessible
        accessibilityLabel={accessibilityLabel}
        onLongPress={optimistic || isDeleted ? undefined : onLongPress}
        onPress={optimistic?.status === 'failed' ? onRetry : undefined}
        style={[
          styles.bubble,
          cornerStyle,
          {
            backgroundColor: bubbleColor,
            borderRadius: radius.bubble,
            padding: spacing.ms,
            opacity: optimistic?.status === 'pending' ? 0.6 : 1,
          },
        ]}
      >
        {hasReply ? (
          <View
            style={[
              styles.replyQuote,
              {
                borderStartColor: textColor,
                backgroundColor: colors.scrim,
                borderRadius: radius.xs,
                padding: spacing.xs,
                marginBottom: spacing.xs,
              },
            ]}
          >
            <Text variant="micro" style={{ color: textColor }} numberOfLines={2}>
              {parent
                ? (parent.text ?? t('chat.repliedAttachment'))
                : t('chat.repliedMessageUnavailable')}
            </Text>
          </View>
        ) : null}

        {!isDeleted && attachments.length > 0 ? (
          <AttachmentView
            attachments={attachments}
            outbound={outbound}
            clientId={message.clientId}
          />
        ) : null}

        {!isDeleted && message.contentType === 'location' ? (
          <LocationView contentAttributes={message.contentAttributes} outbound={outbound} />
        ) : !isDeleted && message.contentType === 'refLink' ? (
          <RichContentView contentType={message.contentType} outbound={outbound} />
        ) : null}

        {bubbleText ? (
          <Text
            style={{
              color: isDeleted ? colors.textTertiary : textColor,
              fontStyle: isDeleted ? 'italic' : 'normal',
            }}
            variant="body"
          >
            {bubbleText}
          </Text>
        ) : null}

        {isGroupEnd ? (
          <View style={[styles.metaRow, { gap: spacing.xxs }]}>
            {optimistic?.status === 'failed' ? (
              <Icon name="alert-circle" size={12} color={colors.danger} />
            ) : optimistic?.status === 'pending' ? (
              <Icon name="time-outline" size={12} color={textColor} />
            ) : outbound ? (
              <Icon name="checkmark" size={12} color={textColor} />
            ) : null}
            <Text variant="micro" numeric style={{ color: textColor, opacity: 0.75 }}>
              {timeLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {optimistic?.status === 'failed' ? (
        <Text variant="caption" color="danger" style={styles.failedLabel}>
          {optimistic.errorMessage ?? t('chat.failedToSendTapRetry')}
        </Text>
      ) : null}
    </View>
  );
}

function messagesEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  const prevOptimistic = getOptimisticStatus(prev.message);
  const nextOptimistic = getOptimisticStatus(next.message);
  return (
    prev.message.id === next.message.id &&
    prev.message.updatedAt === next.message.updatedAt &&
    prev.message.deletedAt === next.message.deletedAt &&
    prev.position === next.position &&
    prev.showMeta === next.showMeta &&
    prevOptimistic?.status === nextOptimistic?.status &&
    prev.messagesById === next.messagesById
  );
}

export const MessageBubble = memo(MessageBubbleImpl, messagesEqual);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
  },
  // Intentionally left as flex-start/flex-end (not left/right) so RTL auto-mirrors bubble side —
  // conventional RTL chat layout (e.g. WhatsApp Arabic still puts outbound bubbles on the left).
  rowOutbound: {
    alignItems: 'flex-end',
  },
  rowInbound: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    gap: 4,
  },
  botLabel: {
    fontWeight: '700',
    marginBottom: 2,
  },
  replyQuote: {
    borderStartWidth: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  failedLabel: {
    marginTop: 2,
  },
});
