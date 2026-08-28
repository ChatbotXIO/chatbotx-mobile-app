import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flattenPages } from '@/api/pagination';
import { ConnectionBanner } from '@/components/ui/connection-banner';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { useMarkConversationRead } from '@/features/conversations/api/use-conversation-actions';
import { findConversationInListCache } from '@/features/conversations/lib/find-conversation-in-cache';
import { isUnread } from '@/features/conversations/lib/conversation-status';
import { ChatHeader } from '@/features/chat/components/chat-header';
import { Composer } from '@/features/chat/components/composer';
import { MessageActionsMenu } from '@/features/chat/components/message-actions-menu';
import { MessageList, type MessageListHandle } from '@/features/chat/components/message-list';
import { useMessagesInfinite, type Message } from '@/features/chat/api/use-messages-infinite';
import { useDeleteMessage, useSetMessageAttributes } from '@/features/chat/api/use-message-actions';
import { removeOptimisticMessage, useSendMessage } from '@/features/chat/api/use-send-message';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { useConnectionBannerState } from '@/realtime/use-connection-store';
import { queryKeys } from '@/api/query-keys';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/** Sibling of `(app)/(tabs)`, not nested inside it — the tab bar is hidden for this screen
 * (declared as a plain Stack.Screen in (app)/_layout.tsx, no Tabs wrapper). */
export default function ChatScreen() {
  const { t } = useTranslation();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const actionsMenuRef = useRef<BottomSheet>(null);
  const messageListRef = useRef<MessageListHandle>(null);

  const messagesQuery = useMessagesInfinite(workspaceId, conversationId ?? null);
  const messages = useMemo(() => flattenPages(messagesQuery.data?.pages), [messagesQuery.data]);
  // `messages` is newest-first (see use-messages-infinite.ts); MessageList wants chronological
  // order. Memoized on `messages` itself (not recomputed inline) so downstream `messagesById`/
  // `rows` memos that depend on this array's identity don't invalidate on every render.
  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages]);

  const markRead = useMarkConversationRead(workspaceId ?? '');
  const sendMessage = useSendMessage(workspaceId ?? '', conversationId ?? '');
  // Read from the shared chat store (set by `useSendMessage`'s `onSuccess`) rather than this
  // screen's own `sendMessage.data` — that mutation instance is used ONLY for the retry path
  // here; the composer instantiates its own separate `useSendMessage(...)` for normal sends, so
  // `sendMessage.data` never reflected a composer send at all. The store is the one place both
  // instances can report to.
  const justSentMessageId =
    useChatStore((state) =>
      conversationId ? state.justSentClientIdByConversation[conversationId] : undefined,
    ) ?? null;
  const deleteMessage = useDeleteMessage(workspaceId ?? '', conversationId ?? '');
  const setAttributes = useSetMessageAttributes(workspaceId ?? '', conversationId ?? '');
  const setComposerMode = useChatStore((state) => state.setComposerMode);
  const setDraft = useChatStore((state) => state.setDraft);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const connectionState = useConnectionBannerState();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !workspaceId) return;
      const conversation = findConversationInListCache(queryClient, workspaceId, conversationId);
      // Guard: previously this fired unconditionally on every focus, generating a network call
      // even when the conversation was already read. Only mark-read when there's something to
      // mark — and only when we actually know the unread state (a cache miss, e.g. a cold deep
      // link with no list query loaded yet, is treated as "unknown, don't guess" rather than
      // either always or never firing).
      if (conversation && isUnread(conversation)) {
        markRead.mutate(conversationId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mark-read is fire-and-forget on focus, re-running per markRead identity would loop.
    }, [conversationId, workspaceId]),
  );

  // Tracks which conversation is currently on-screen so `src/lib/notifications.ts`'s foreground
  // notification handler (called from outside React, via `useChatStore.getState()`) can suppress
  // the in-app banner for a push about the conversation the user is already viewing. Cleared on
  // blur/unmount rather than left set, so navigating away (or the app backgrounding) doesn't keep
  // suppressing notifications for a conversation that's no longer visible.
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return undefined;
      setActiveConversationId(conversationId);
      return () => setActiveConversationId(null);
    }, [conversationId, setActiveConversationId]),
  );

  function handleRetry(message: Message) {
    if (!message.clientId) return;

    // Rebuild the ORIGINAL send params from the failed optimistic row — previously this only
    // re-sent `text`, silently dropping any attachments or reply context, so retrying a failed
    // attachment/reply send produced a plain text message instead of the thing the user actually
    // tried to send.
    const attachments =
      message.attachments.length > 0
        ? message.attachments.map((attachment) => ({
            uri: attachment.originPath,
            mimeType: attachment.mimeType,
            fileName: attachment.name ?? attachment.originPath.split('/').pop() ?? 'attachment',
          }))
        : undefined;

    // `parentId` only carries the parent's id, not its `createdAt` (which `replyTo` needs) —
    // recover it from the already-loaded messages list rather than a fresh cache lookup.
    const parent = message.parentId
      ? messages.find((candidate) => candidate.id === message.parentId)
      : undefined;
    const replyTo = parent ? { messageId: parent.id, createdAt: parent.createdAt } : undefined;

    sendMessage.mutate({
      workspaceId: workspaceId ?? '',
      conversationId: conversationId ?? '',
      text: message.text ?? undefined,
      attachments,
      replyTo,
      clientId: message.clientId,
    });
  }

  function handleLongPress(message: Message) {
    setSelectedMessage(message);
    actionsMenuRef.current?.expand();
  }

  function handleEditAndResend(message: Message) {
    if (!workspaceId || !conversationId || !message.clientId) return;
    removeOptimisticMessage(
      queryClient,
      queryKeys.ws.messages.list(workspaceId, conversationId),
      message.clientId,
    );
    setDraft(conversationId, message.text ?? '');
    actionsMenuRef.current?.close();
  }

  if (!workspaceId || !conversationId) {
    return <Screen />;
  }

  const normalizedError = messagesQuery.error ? normalizeApiError(messagesQuery.error) : null;
  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} message={normalizedError.message} />
      </Screen>
    );
  }

  function handleHeaderLayout(event: LayoutChangeEvent) {
    setHeaderHeight(event.nativeEvent.layout.height);
  }

  return (
    <Screen edges={['top']}>
      <ChatHeader
        workspaceId={workspaceId}
        conversationId={conversationId}
        onBack={() => router.back()}
        onLayout={handleHeaderLayout}
      />
      <ConnectionBanner state={connectionState} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight + insets.top}
      >
        {messagesQuery.isError ? (
          <ErrorBanner
            message={describeApiError(messagesQuery.error, t)}
            actionLabel={t('common.retry')}
            onAction={() => messagesQuery.refetch()}
          />
        ) : null}
        <MessageList
          ref={messageListRef}
          messages={chronologicalMessages}
          isLoading={messagesQuery.isPending}
          hasNextPage={Boolean(messagesQuery.hasNextPage)}
          isFetchingNextPage={messagesQuery.isFetchingNextPage}
          conversationId={conversationId}
          justSentMessageId={justSentMessageId}
          onLoadOlder={() => messagesQuery.fetchNextPage()}
          onLongPressMessage={handleLongPress}
          onRetryMessage={handleRetry}
        />
        <Composer
          workspaceId={workspaceId}
          conversationId={conversationId}
          style={isKeyboardVisible ? undefined : { paddingBottom: insets.bottom }}
        />
      </KeyboardAvoidingView>

      <MessageActionsMenu
        ref={actionsMenuRef}
        message={selectedMessage}
        onEdit={(message) => {
          setComposerMode(conversationId, { type: 'edit', message });
          setDraft(conversationId, message.text ?? '');
          actionsMenuRef.current?.close();
        }}
        onReply={(message) => {
          setComposerMode(conversationId, { type: 'reply', message });
          actionsMenuRef.current?.close();
        }}
        onDelete={(message) => {
          deleteMessage.mutate({ messageId: message.id, createdAt: message.createdAt });
          actionsMenuRef.current?.close();
        }}
        onLike={(message) => {
          setAttributes.mutate({
            messageId: message.id,
            createdAt: message.createdAt,
            liked: true,
          });
          actionsMenuRef.current?.close();
        }}
        onHide={(message) => {
          setAttributes.mutate({
            messageId: message.id,
            createdAt: message.createdAt,
            hidden: true,
          });
          actionsMenuRef.current?.close();
        }}
        onEditAndResend={handleEditAndResend}
      />
    </Screen>
  );
}
