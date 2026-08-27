import type {
  RealtimeEventCreateMessage,
  RealtimeEventMessageDeleted,
  RealtimeEventMessageFailed,
  RealtimeEventMessageIdAssigned,
  RealtimeEventMessageUpdated,
} from '@/realtime/events';
import type { ListMessagesResponse, Message } from '@/features/chat/api/use-messages-infinite';

/**
 * Pure functions: `(currentData, event) => newData`, never mutating the input — called from
 * use-realtime-handlers.ts via `queryClient.setQueryData`. Kept pure/side-effect-free so they stay
 * easy to unit test later (the plan notes jest-expo coverage for exactly this kind of pure cache
 * applier, even though no test infra exists yet this phase).
 */
export type InfiniteMessagesData =
  { pages: ListMessagesResponse[]; pageParams: unknown[] } | undefined;

/** Normalizes as well as narrows: `attachments` is required by the `Message` type and dereferenced
 * unguarded by message-bubble.tsx, but nothing guarantees a wire payload includes it. Defaulting it
 * here (rather than only guarding at render) keeps the cache well-formed for every consumer.
 * Exported so `apply-conversation-events.ts` and other realtime helpers can reuse the same
 * narrowing when they only need the conversationId/id out of an untyped `messageCreated` payload. */
export function narrowIncomingMessage(data: unknown): Message | null {
  if (!data || typeof data !== 'object') return null;
  if (!('id' in data) || typeof data.id !== 'string') return null;
  const message = data as Message;
  return Array.isArray(message.attachments) ? message : { ...message, attachments: [] };
}

/**
 * messageCreated: if the event carries a `clientId` that matches a pending optimistic entry in
 * cache (our own send, echoed back), replace that entry with the confirmed message — this is the
 * SAME reconciliation use-send-message.ts already does from its own mutation response, so this
 * path mainly matters for messages that arrive from OTHER clients/channels. If no match, prepend
 * as a new message (guarding against a duplicate by id, in case the same event is delivered twice
 * or the sender's own mutation-response reconciliation already inserted it).
 *
 * `targetConversationId` guards against the cross-conversation cache leak: the caller
 * (use-realtime-handlers.ts) is expected to only route a `messageCreated` event to the ONE
 * matching conversation's messages-list query key in the first place, but this guard is kept as
 * defense-in-depth (e.g. against a future caller that fans this out more broadly again) — a
 * message whose own `conversationId` doesn't match the query it's being applied to is a no-op.
 */
export function applyMessageCreated(
  current: InfiniteMessagesData,
  event: RealtimeEventCreateMessage,
  targetConversationId: string,
): InfiniteMessagesData {
  if (!current) return current;
  const incoming = narrowIncomingMessage(event.data);
  if (!incoming) return current;
  if (incoming.conversationId !== targetConversationId) return current;

  const [firstPage, ...restPages] = current.pages;
  if (!firstPage) return current;

  const clientId = 'clientId' in incoming ? incoming.clientId : undefined;
  const pendingIndex = clientId
    ? firstPage.data.findIndex((message) => 'clientId' in message && message.clientId === clientId)
    : -1;
  const alreadyPresent = firstPage.data.some((message) => message.id === incoming.id);

  let newData: Message[];
  if (pendingIndex >= 0) {
    newData = firstPage.data.map((message, index) => (index === pendingIndex ? incoming : message));
  } else if (alreadyPresent) {
    newData = firstPage.data;
  } else {
    newData = [incoming, ...firstPage.data];
  }

  return { ...current, pages: [{ ...firstPage, data: newData }, ...restPages] };
}

export function applyMessageDeleted(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageDeleted,
): InfiniteMessagesData {
  if (!current) return current;
  const deletedIds = new Set(event.data.messageIds);

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) =>
        deletedIds.has(message.id) ? { ...message, deletedAt: new Date().toISOString() } : message,
      ),
    })),
  };
}

/**
 * Patches the edited text only. The web app's equivalent handler (`updateMessageText` in
 * ../aha.chat apps/builder/src/features/chat/store/chat-store.ts) also reconstructs a full
 * attachment object from `newAttachmentPath`/`newAttachmentMimeType`/etc when an attachment was
 * added/replaced/removed during the edit — deliberately NOT mirrored here, since Phase 4's own
 * edit-message UI is itself a stub (no attachment-edit affordance exists yet to trigger this
 * server-side), so building the full attachment-reconstruction logic now would have nothing to
 * exercise it. Revisit once message edit UI grows an attachment-replace flow.
 */
export function applyMessageUpdated(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageUpdated,
): InfiniteMessagesData {
  if (!current) return current;
  const { messageId, newText } = event.data;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) =>
        message.id === messageId ? { ...message, text: newText } : message,
      ),
    })),
  };
}

/** Mirrors the `__optimisticStatus`/`__optimisticError` shape use-send-message.ts's onError
 * already writes, so message-bubble.tsx's existing rendering (via getOptimisticStatus) picks this
 * up unchanged — this is the realtime-driven version of the same failure signal, for cases where
 * the failure is detected server-side/async rather than by the sender's own mutation rejecting. */
export function applyMessageFailed(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageFailed,
): InfiniteMessagesData {
  if (!current) return current;
  const { messageId, clientId, error } = event.data;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) => {
        const matches = clientId
          ? 'clientId' in message && message.clientId === clientId
          : message.id === messageId;
        if (!matches) return message;
        return {
          ...message,
          __optimisticStatus: 'failed',
          __optimisticError: error ?? 'Failed to send',
        } as unknown as Message;
      }),
    })),
  };
}

/** Mirrors the web app's `assignMessageCommentId` handler exactly (../aha.chat
 * apps/builder/src/features/chat/store/chat-store.ts) — the comment id lands on `sourceId`, not
 * `parentId` (parentId means something different: thread/reply linkage). */
export function applyMessageIdAssigned(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageIdAssigned,
): InfiniteMessagesData {
  if (!current) return current;
  const { messageId, commentId } = event.data;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) =>
        message.id === messageId ? { ...message, sourceId: commentId } : message,
      ),
    })),
  };
}
