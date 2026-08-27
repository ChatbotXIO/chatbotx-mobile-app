import type {
  RealtimeEventConversationAssigned,
  RealtimeEventConversationUpdated,
  RealtimeEventContactCommon,
  RealtimeEventCreateMessage,
} from '@/realtime/events';
import { narrowIncomingMessage } from '@/realtime/apply-message-events';
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
 * conversation row for that contact — a contact can back multiple conversations (see Phase 3's
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

/** Patches a standalone `queryKeys.ws.contacts.detail` cache entry's `blockedAt` field — added in
 * Phase 6 alongside the contacts feature. `applyContactBlockState` above only reaches the
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

/**
 * Companion to `applyMessageCreated` in apply-message-events.ts: when a `messageCreated` event
 * arrives, the messages-list cache for the open conversation gets the new message (that applier),
 * and this one ALSO patches the matching conversation-list ROW so the inbox preview stays live
 * without a refetch — updates `lastActivityAt`, splices the message onto the row's `messages[]`
 * preview array (capped to the last few entries, matching `conversation-row.tsx`'s
 * `lastMessagePreview` which only ever reads the LAST entry), and moves that row to the top of
 * whichever page it was found on (conventional "most recent conversation first" ordering).
 *
 * Deliberately does NOT attempt to fabricate a brand-new row when the conversation isn't cached
 * anywhere — the event payload is a single message, not a full conversation row, so there's no
 * contact/channel/assignee data to build one from. Callers should invalidate instead (see `found`
 * on the return value).
 */
const MAX_PREVIEW_MESSAGES = 20;

export function applyConversationMessageCreated(
  current: InfiniteConversationsData,
  event: RealtimeEventCreateMessage,
): ApplyConversationMessageCreatedResult {
  if (!current) return { data: current, found: false };

  const incoming = narrowIncomingMessage(event.data);
  if (!incoming) return { data: current, found: false };

  let found = false;

  const pages = current.pages.map((page) => {
    const matchIndex = page.data.findIndex((item) => item.id === incoming.conversationId);
    if (matchIndex < 0) return page;

    found = true;
    const matched = page.data[matchIndex]!;
    const patchedRow: ConversationListItem = {
      ...matched,
      lastActivityAt: incoming.createdAt,
      messages: [...matched.messages, incoming].slice(-MAX_PREVIEW_MESSAGES),
    };

    // Move the patched row to the front of this page — mirrors "most recently active
    // conversation first" ordering without waiting on a refetch.
    const rest = page.data.filter((_, index) => index !== matchIndex);
    return { ...page, data: [patchedRow, ...rest] };
  });

  return { data: { ...current, pages }, found };
}

// `conversationCreated` carries the full new conversation row as `data: unknown` (the source
// package deliberately keeps this untyped to avoid a database-schema dependency — see events.ts
// comment). Splicing an unknown-shaped row into the strongly-typed `ConversationListItem[]` cache
// risks silently corrupting it with missing fields the UI assumes exist, so there's no applier
// function for it here — use-realtime-handlers.ts calls `queryClient.invalidateQueries` directly
// for the active conversations-list keys instead: one extra network round-trip on a relatively
// rare event, in exchange for never rendering a malformed row.
