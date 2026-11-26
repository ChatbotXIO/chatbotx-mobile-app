import type {
  RealtimeEventConversationAssigned,
  RealtimeEventConversationUpdated,
  RealtimeEventContactCommon,
  RealtimeEventCreateMessage,
} from '@/realtime/events';
import { narrowIncomingMessage } from '@/realtime/apply-message-events';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

/** Pure functions patching the conversations-list infinite-query cache shape — see
 * apply-message-events.ts for the same design rationale (pure, immutable, testable later). */
export type InfiniteConversationsData =
  { pages: ListConversationsResponse[]; pageParams: unknown[] } | undefined;

function patchMatching(
  current: InfiniteConversationsData,
  matches: (item: ConversationListItem) => boolean,
  patch: Partial<ConversationListItem>,
): InfiniteConversationsData {
  if (!current) return current;
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((item) => (matches(item) ? { ...item, ...patch } : item)),
    })),
  };
}

export function applyConversationAssigned(
  current: InfiniteConversationsData,
  event: RealtimeEventConversationAssigned,
): InfiniteConversationsData {
  const idSet = new Set(event.data.conversationIds);
  return patchMatching(current, (item) => idSet.has(item.id), {
    assignedUserId: event.data.assignedUserId,
    assignedInboxTeamId: event.data.assignedInboxTeamId,
  });
}

export function applyConversationUpdated(
  current: InfiniteConversationsData,
  event: RealtimeEventConversationUpdated,
): InfiniteConversationsData {
  const idSet = new Set(event.data.conversationIds);
  return patchMatching(current, (item) => idSet.has(item.id), event.data.changes);
}

/** `contactBlocked`/`contactUnblocked` patch the embedded `contact.blockedAt` field on every
 * conversation row for that contact — a contact can back multiple conversations (see the
 * assign-by-contact applier for the same one-contact-many-conversations pattern). */
export function applyContactBlockState(
  current: InfiniteConversationsData,
  event: RealtimeEventContactCommon,
  blocked: boolean,
): InfiniteConversationsData {
  if (!current) return current;
  const { contactId } = event.data;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((item) =>
        item.contactId === contactId && item.contact
          ? {
              ...item,
              contact: { ...item.contact, blockedAt: blocked ? new Date().toISOString() : null },
            }
          : item,
      ),
    })),
  };
}

/** Patches a standalone `queryKeys.ws.contacts.detail` cache entry's `blockedAt` field — added
 * alongside the contacts feature. `applyContactBlockState` above only reaches the
 * conversations-list cache's embedded contact object; this covers the separate contact-detail
 * query the contact panel reads (use-contact-detail.ts), which has its own `blockedAt` field at
 * the top level (not nested under `contact`). Callers scan for a query keyed
 * `['ws', workspaceId, 'contacts', 'detail', contactId]` and setQueryData through this. */
export function applyContactDetailBlockState<T extends { blockedAt: string | null }>(
  current: T | undefined,
  blocked: boolean,
): T | undefined {
  if (!current) return current;
  return { ...current, blockedAt: blocked ? new Date().toISOString() : null };
}

export interface ApplyConversationMessageCreatedResult {
  data: InfiniteConversationsData;
  /** Whether the incoming message's conversation was found (and patched) in ANY cached list page.
   * `false` means no row exists in cache to patch — use-realtime-handlers.ts uses this signal to
   * fall back to a debounced `invalidateQueries` instead of fabricating a new row from the
   * partial/untyped message payload. */
  found: boolean;
}

export interface ApplyConversationMessagesCreatedResult {
  data: InfiniteConversationsData;
  /** Ids of the conversations that had a row in this cache (patched, or already newer). */
  foundIds: Set<string>;
}

/** The inbox row preview only ever reads the LAST message (see `conversation-preview.ts`), so a
 * single entry is enough — keeping more only made every patch and structural-sharing pass heavier. */
const MAX_PREVIEW_MESSAGES = 1;

function activityTime(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Batched companion to `applyMessageCreated`: patches the conversation-list ROWS for a whole burst
 * of `messageCreated` messages in ONE pass over the pages (instead of one pass per message).
 *
 * Per conversation only the newest message (last in `incomingList`) becomes the preview, and
 * `lastActivityAt` only ever moves forward — an older (replayed) message never overwrites it.
 * Matched rows on the FIRST page are hoisted to the front, ordered by `lastActivityAt` descending;
 * a row on a later page is patched in place, since the list is cursor-paginated and moving a row
 * across a page boundary would duplicate it and desync every subsequent page's cursor.
 *
 * `activeConversationId` — when it matches a patched row — also bumps `agentLastReadAt`, so the
 * unread badge doesn't drift while the user is looking at that chat.
 *
 * Never fabricates a row for a conversation that isn't cached; callers invalidate for the ids
 * missing from `foundIds`.
 */
export function applyConversationMessagesCreated(
  current: InfiniteConversationsData,
  incomingList: Message[],
  activeConversationId: string | null = null,
): ApplyConversationMessagesCreatedResult {
  const foundIds = new Set<string>();
  if (!current || incomingList.length === 0) return { data: current, foundIds };

  const latestByConversation = new Map<string, Message>();
  for (const message of incomingList) {
    const existing = latestByConversation.get(message.conversationId);
    if (!existing || activityTime(message.createdAt) >= activityTime(existing.createdAt)) {
      latestByConversation.set(message.conversationId, message);
    }
  }

  const pages = current.pages.map((page, pageIndex) => {
    const patchedIndexes = new Set<number>();
    const data = page.data.map((item, index) => {
      const incoming = latestByConversation.get(item.id);
      if (!incoming) return item;
      foundIds.add(item.id);

      // Stale/replayed message: keep the row (and its preview) untouched.
      if (activityTime(incoming.createdAt) < activityTime(item.lastActivityAt)) return item;

      patchedIndexes.add(index);
      return {
        ...item,
        lastActivityAt: incoming.createdAt ?? item.lastActivityAt,
        messages: [incoming].slice(-MAX_PREVIEW_MESSAGES),
        ...(item.id === activeConversationId && incoming.createdAt
          ? { agentLastReadAt: incoming.createdAt }
          : {}),
      } as ConversationListItem;
    });

    if (patchedIndexes.size === 0) return page;
    if (pageIndex !== 0) return { ...page, data };

    const patched = data
      .filter((_, index) => patchedIndexes.has(index))
      .sort((a, b) => activityTime(b.lastActivityAt) - activityTime(a.lastActivityAt));
    const rest = data.filter((_, index) => !patchedIndexes.has(index));
    return { ...page, data: [...patched, ...rest] };
  });

  if (foundIds.size === 0) return { data: current, foundIds };
  return { data: { ...current, pages }, foundIds };
}

/** Single-event form of `applyConversationMessagesCreated`. */
export function applyConversationMessageCreated(
  current: InfiniteConversationsData,
  event: RealtimeEventCreateMessage,
  activeConversationId: string | null = null,
): ApplyConversationMessageCreatedResult {
  const incoming = narrowIncomingMessage(event.data);
  if (!current || !incoming) return { data: current, found: false };

  const { data, foundIds } = applyConversationMessagesCreated(
    current,
    [incoming],
    activeConversationId,
  );
  return { data, found: foundIds.has(incoming.conversationId) };
}
