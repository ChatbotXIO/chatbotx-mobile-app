import { FlashList, type FlashListRef } from '@shopify/flash-list';
import dayjs from 'dayjs';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateSeparator } from '@/components/ui/date-separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { computeMessageGroups } from '@/features/chat/lib/message-groups';

import { MessageBubble } from './message-bubble';
import { ScrollToBottomFab } from './scroll-to-bottom-fab';
import { TypingIndicator } from './typing-indicator';

export interface MessageListHandle {
  scrollToEnd: () => void;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  conversationId: string;
  /** id of the message most recently sent by the current user, if any — used to force
   * auto-scroll-to-end even when the user had scrolled away, since a just-sent message should
   * always be visible to its sender. */
  justSentMessageId?: string | null;
  onLoadOlder: () => void;
  onLongPressMessage: (message: Message) => void;
  onRetryMessage: (message: Message) => void;
}

type ListRow =
  | { kind: 'separator'; id: string; date: string }
  | {
      kind: 'bubble';
      id: string;
      message: Message;
      position: ReturnType<typeof computeMessageGroups>[number]['position'];
      showMeta: boolean;
    };

const NEAR_BOTTOM_THRESHOLD_PX = 120;

function buildRows(messages: Message[]): ListRow[] {
  const groups = computeMessageGroups(messages);
  const rows: ListRow[] = [];
  let lastDay: string | null = null;

  messages.forEach((message, index) => {
    const day = dayjs(message.createdAt).format('YYYY-MM-DD');
    if (day !== lastDay) {
      rows.push({ kind: 'separator', id: `sep-${day}`, date: message.createdAt });
      lastDay = day;
    }
    const group = groups[index]!;
    rows.push({
      kind: 'bubble',
      id: message.clientId ?? message.id,
      message,
      position: group.position,
      showMeta: group.showMeta,
    });
  });

  return rows;
}

/**
 * FlashList v2 (installed: 2.0.2) dropped the v1 `inverted` prop in favor of
 * `maintainVisibleContentPosition` — so `messages` here is rendered in NATURAL chat order
 * (oldest → newest, newest at the bottom), the opposite of the API's own cursor order
 * (`nextCursor` walks toward older messages). `flattenMessagePages` in use-messages-infinite.ts
 * returns pages in fetch order (newest page first, since page 1 is the most recent messages), so
 * the CALLER (the chat screen) is expected to pass `messages` already reversed into chronological
 * order — this component memoizes the row-building (grouping + date separators) from whatever
 * chronological array it's given, but does not re-reverse on every render itself (that was a
 * standing perf bug: the previous version called `[...messages].reverse()` inline in the render
 * body, discarding the result every re-render for no reason since `messages` is stable per query
 * update).
 */
export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  {
    messages,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    conversationId,
    justSentMessageId,
    onLoadOlder,
    onLongPressMessage,
    onRetryMessage,
  },
  ref,
) {
  const { t } = useTranslation();
  const listRef = useRef<FlashListRef<ListRow>>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(0);
  const lastMessageIdRef = useRef<string | null>(null);
  // Mirrors `isNearBottom` state into a ref so the new-message effect below can read it as a
  // snapshot at the moment a message arrives, without needing it in the effect's dependency array
  // (which would re-fire the effect — and risk a duplicate scroll/counter bump — on every scroll).
  const isNearBottomRef = useRef(true);
  isNearBottomRef.current = isNearBottom;

  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messages) {
      map.set(message.id, message);
      if (message.clientId) map.set(message.clientId, message);
    }
    return map;
  }, [messages]);

  const rows = useMemo(() => buildRows(messages), [messages]);

  useImperativeHandle(ref, () => ({
    scrollToEnd: () => {
      listRef.current?.scrollToEnd({ animated: true });
      setHasNewMessages(0);
    },
  }));

  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.clientId ?? lastMessage?.id ?? null;

  // Auto-scroll when a NEW message arrives (id changed since the previous commit) and either it's
  // our own just-sent message or we're already near the bottom; otherwise bump the "new messages"
  // counter for the FAB instead of yanking the view. Runs as an effect (not inline during render)
  // since scrollToEnd is an imperative side effect on the list ref, which must not fire before the
  // ref is attached / the row list has committed.
  useEffect(() => {
    if (!lastMessageId || lastMessageId === lastMessageIdRef.current) return;
    const isFirstRender = lastMessageIdRef.current === null;
    const isOwnSend = justSentMessageId != null && lastMessageId === justSentMessageId;
    lastMessageIdRef.current = lastMessageId;

    if (isFirstRender) return;

    if (isOwnSend || isNearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    } else {
      setHasNewMessages((count) => count + 1);
    }
  }, [lastMessageId, justSentMessageId]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;
    const nearBottom = distanceFromEnd < NEAR_BOTTOM_THRESHOLD_PX;
    setIsNearBottom(nearBottom);
    if (nearBottom) setHasNewMessages(0);
  }

  if (isLoading) {
    return (
      <FlashList
        data={Array.from({ length: 8 })}
        keyExtractor={(_, index) => `skeleton-${index}`}
        renderItem={() => <Skeleton height={44} style={styles.skeleton} />}
      />
    );
  }

  if (messages.length === 0) {
    return <EmptyState icon="chatbubble-ellipses-outline" title={t('chat.noMessages')} />;
  }

  return (
    <>
      <FlashList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.id}
        getItemType={(row) => (row.kind === 'separator' ? 'separator' : `bubble-${row.position}`)}
        renderItem={({ item }) =>
          item.kind === 'separator' ? (
            <DateSeparator date={item.date} />
          ) : (
            <MessageBubble
              message={item.message}
              position={item.position}
              showMeta={item.showMeta}
              messagesById={messagesById}
              onLongPress={() => onLongPressMessage(item.message)}
              onRetry={() => onRetryMessage(item.message)}
            />
          )
        }
        maintainVisibleContentPosition={{ startRenderingFromBottom: true }}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onStartReachedThreshold={0.4}
        onStartReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            onLoadOlder();
          }
        }}
        ListFooterComponent={<TypingIndicator conversationId={conversationId} />}
      />
      {!isNearBottom && hasNewMessages > 0 ? (
        <ScrollToBottomFab
          newMessageCount={hasNewMessages}
          onPress={() => {
            listRef.current?.scrollToEnd({ animated: true });
            setHasNewMessages(0);
          }}
        />
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
});
