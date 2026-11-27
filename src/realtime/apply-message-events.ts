import type {
  RealtimeEventCreateMessage,
  RealtimeEventMessageContentUpdated,
  RealtimeEventMessageDeleted,
  RealtimeEventMessageFailed,
  RealtimeEventMessageIdAssigned,
  RealtimeEventMessageRemoved,
  RealtimeEventMessageUpdated,
} from '@/realtime/events';
import type { Message, MessagesInfiniteData } from '@/features/chat/api/use-messages-infinite';
import {
  getMessageClientId,
  markOptimisticFailed,
  stripOptimisticFields,
} from '@/features/chat/components/optimistic-message';
import { DELIVERY_FAILED_ERROR_KIND } from '@/features/chat/lib/send-status';

/**
 * Pure functions: `(currentData, event) => newData`, never mutating the input — called from
 * use-realtime-handlers.ts via `queryClient.setQueryData`. Kept pure/side-effect-free so they stay
 * easy to unit test later (the plan notes jest-expo coverage for exactly this kind of pure cache
 * applier, even though no test infra exists yet this phase).
 */
export type InfiniteMessagesData = MessagesInfiniteData | undefined;

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

function timeOf(message: Message): number {
  return Date.parse(message.createdAt);
}

/** Inserts `incoming` into a newest-first list at its `createdAt` position. Realtime frames can
 * deliver messages out of order, so always prepending would misplace an older message; an
 * unparseable timestamp falls back to the top. */
export function insertByCreatedAt(data: Message[], incoming: Message): Message[] {
  const incomingTime = timeOf(incoming);
  if (Number.isNaN(incomingTime)) return [incoming, ...data];
  const index = data.findIndex((message) => timeOf(message) <= incomingTime);
  if (index === -1) return [...data, incoming];
  return [...data.slice(0, index), incoming, ...data.slice(index)];
}

/**
 * messageCreated. The server never stores `clientId` — it is only echoed on this event — so this
 * is the one place an own send's local row learns it was persisted, apart from the create
 * response (see `reconcileSentMessage`).
 *
 * - A row sharing the event's `clientId` (our own send) is replaced in place by the server
 *   message, keeping the `clientId` so the bubble's key and send status stay stable.
 * - Otherwise a row already holding the same id is left as is (duplicate delivery).
 * - Otherwise the message is inserted into the first page by `createdAt`.
 *
 * Every other row holding the same id, on any page, is dropped — the create response or a refetch
 * may have landed it before this event did.
 *
 * `targetConversationId` is defense-in-depth against a cross-conversation cache leak: the caller
 * routes the event to the matching conversation's cache only, and a message whose own
 * `conversationId` differs is a no-op here.
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
  if (current.pages.length === 0) return current;

  const clientId = getMessageClientId(incoming);
  const isOwnRow = (message: Message) => !!clientId && getMessageClientId(message) === clientId;

  let replaced = false;
  const pages = current.pages.map((page) => ({
    ...page,
    data: page.data.flatMap((message): Message[] => {
      if (!replaced && isOwnRow(message)) {
        replaced = true;
        return [{ ...incoming, clientId } as Message];
      }
      if (message.id !== incoming.id && !isOwnRow(message)) return [message];
      return [];
    }),
  }));

  if (replaced) return { ...current, pages };

  const alreadyPresent = current.pages.some((page) =>
    page.data.some((message) => message.id === incoming.id),
  );
  if (alreadyPresent) return current;

  const [firstPage, ...restPages] = pages;
  return {
    ...current,
    pages: [{ ...firstPage!, data: insertByCreatedAt(firstPage!.data, incoming) }, ...restPages],
  };
}

/**
 * The create request for an own send resolved with the server id. A refetch can't do this match
 * itself — fetched messages carry no `clientId` — so the local row takes the server id now and
 * leaves its pending state (the send-status store says "sending" until the channel answers).
 * If a server row with that id is already cached (a refetch or `messageCreated` beat the
 * response), the local row is merged into it instead, so the timeline never shows both.
 */
export function reconcileSentMessage(
  current: InfiniteMessagesData,
  clientId: string,
  serverId: string,
): InfiniteMessagesData {
  if (!current) return current;
  let local: Message | null = null;
  for (const page of current.pages) {
    local = page.data.find((message) => getMessageClientId(message) === clientId) ?? null;
    if (local) break;
  }
  if (!local) return current;

  const hasServerRow = current.pages.some((page) =>
    page.data.some(
      (message) => message.id === serverId && getMessageClientId(message) !== clientId,
    ),
  );

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.flatMap((message): Message[] => {
        if (getMessageClientId(message) === clientId) {
          return hasServerRow ? [] : [{ ...stripOptimisticFields(message), id: serverId }];
        }
        if (message.id === serverId) return [{ ...message, clientId } as Message];
        return [message];
      }),
    })),
  };
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
 * Patches the edited text only. The web app's equivalent handler (`updateMessageText`) also
 * reconstructs a full attachment object from `newAttachmentPath`/`newAttachmentMimeType`/etc when an attachment was
 * added/replaced/removed during the edit — deliberately NOT mirrored here, since this app's own
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

/**
 * messageFailed is the channel's answer to an outgoing send, success included: `error: null` means
 * the channel accepted the message, a string is the reason it rejected it. Mirrors the web inbox,
 * which writes `error` straight onto the row's `sendError` — `null` clears a stale error after a
 * successful retry. A matched local optimistic row also leaves its pending state, since the server
 * has now answered for it. The bubble's "sending" state between the create response and this
 * event comes from use-send-status-store.ts, not from the cache.
 */
export function applyMessageFailed(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageFailed,
): InfiniteMessagesData {
  if (!current) return current;
  const { messageId, clientId } = event.data;
  const sendError = event.data.error ?? null;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) => {
        const matches =
          message.id === messageId || (!!clientId && getMessageClientId(message) === clientId);
        if (!matches) return message;
        return { ...stripOptimisticFields(message), sendError };
      }),
    })),
  };
}

/**
 * messageRemoved drops rows the server deleted after a send failed for good. A row this device
 * sent is kept instead as a failed local row, so the user sees what didn't go out and can tap to
 * retry — the same shape use-send-message.ts writes when the create request itself fails.
 *
 * `ownSends` maps the removed server id to the clientId of this device's send (resolved by the
 * caller from use-send-status-store.ts). A row is matched by either id, since a refetch may have
 * swapped the local row for the server's copy; the clientId is put back so retry reuses it.
 */
export function applyMessageRemoved(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageRemoved,
  ownSends: ReadonlyMap<string, string>,
): InfiniteMessagesData {
  if (!current) return current;
  const removedIds = new Set(event.data.messageIds);
  const ownClientIds = new Set(ownSends.values());
  const ownClientIdOf = (message: Message): string | undefined => {
    const clientId = getMessageClientId(message);
    if (clientId && ownClientIds.has(clientId)) return clientId;
    return ownSends.get(message.id);
  };

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.flatMap((message): Message[] => {
        const clientId = ownClientIdOf(message);
        if (clientId) {
          return [
            markOptimisticFailed({ ...message, clientId } as Message, DELIVERY_FAILED_ERROR_KIND),
          ];
        }
        return removedIds.has(message.id) ? [] : [message];
      }),
    })),
  };
}

/** messageContentUpdated: the server enriched a message's structured payload after the fact
 * (e.g. a call transcript). It always sends the complete `contentAttributes`, so this replaces
 * rather than merges — same as the web inbox. */
export function applyMessageContentUpdated(
  current: InfiniteMessagesData,
  event: RealtimeEventMessageContentUpdated,
): InfiniteMessagesData {
  if (!current) return current;
  const { messageId, contentAttributes } = event.data;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((message) =>
        message.id === messageId ? ({ ...message, contentAttributes } as Message) : message,
      ),
    })),
  };
}

/** Mirrors the web app's `assignMessageCommentId` handler exactly — the comment id lands on
 * `sourceId`, not `parentId` (parentId means something different: thread/reply linkage). */
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
