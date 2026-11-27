import { notifyManager, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '@/api/query-keys';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import {
  findTrackedClientId,
  useSendStatusStore,
} from '@/features/chat/stores/use-send-status-store';
import { narrowIncomingMessage, type InfiniteMessagesData } from './apply-message-events';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import {
  applyMessageContentUpdated,
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageFailed,
  applyMessageIdAssigned,
  applyMessageRemoved,
  applyMessageUpdated,
} from './apply-message-events';
import type { InfiniteConversationsData } from './apply-conversation-events';
import {
  applyConversationMessagesCreated,
  applyContactBlockState,
  applyContactDetailBlockState,
  applyConversationAssigned,
  applyConversationUpdated,
} from './apply-conversation-events';
import { scheduleTypingExpiry, clearTypingTimer } from './typing-timers';
import {
  RealtimeEventType,
  type RealtimeEventCreateMessage,
  type RealtimeEventData,
} from './events';

/** Default typing-indicator TTL (seconds) when the event's own `seconds` field is 0/undefined —
 * per the plan, a payload that doesn't specify a TTL still shouldn't stick forever. */
const DEFAULT_TYPING_TTL_SECONDS = 5;

/** How long to wait, after a `messageCreated` event whose conversation isn't found in ANY cached
 * list page, before invalidating the conversations list — debounced (rather than firing per
 * event) so a burst of messages for the same not-yet-cached conversation doesn't trigger a
 * refetch storm. Keyed by workspaceId since this hook is itself workspace-scoped. */
const CONVERSATION_INVALIDATE_DEBOUNCE_MS = 500;
const pendingConversationInvalidate = new Map<string, ReturnType<typeof setTimeout>>();

function debounceInvalidateConversationsList(queryClient: QueryClient, workspaceId: string) {
  const existing = pendingConversationInvalidate.get(workspaceId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingConversationInvalidate.delete(workspaceId);
    queryClient.invalidateQueries({ queryKey: ['ws', workspaceId, 'conversations', 'list'] });
  }, CONVERSATION_INVALIDATE_DEBOUNCE_MS);
  pendingConversationInvalidate.set(workspaceId, timer);
}

/** Clears every pending debounced conversations-list invalidation across all workspaces —
 * these are module-scope timers (not tied to any component's lifecycle), so without an explicit
 * teardown they outlive the realtime connection that scheduled them, leaking a timer per
 * not-yet-cached conversation and holding the Jest process open after tests finish. Call this
 * alongside `clearAllTypingTimers()` wherever the realtime connection itself is torn down. */
export function clearPendingConversationInvalidates(): void {
  pendingConversationInvalidate.forEach((timer) => clearTimeout(timer));
  pendingConversationInvalidate.clear();
}

/** A single frame holding more events than this (e.g. a 500-event reconnect replay) is cheaper to
 * recover by refetching than by patching every cache event by event. */
const BURST_REFETCH_THRESHOLD = 100;

function conversationsListKey(workspaceId: string) {
  return ['ws', workspaceId, 'conversations', 'list'] as const;
}

/** Patches every cached conversations-list query that someone is watching. A cache with no
 * observer is only marked stale (no refetch): it refetches when next mounted, so patching it
 * would be wasted work. Returns how many caches were patched. */
function patchObservedConversationLists(
  queryClient: QueryClient,
  workspaceId: string,
  patch: (old: InfiniteConversationsData) => InfiniteConversationsData,
): number {
  let patched = 0;
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: conversationsListKey(workspaceId) })) {
    if (query.getObserversCount() === 0) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey, refetchType: 'none' });
      continue;
    }
    patched += 1;
    queryClient.setQueryData<InfiniteConversationsData>(query.queryKey, patch);
  }
  return patched;
}

/** Applies a run of consecutive `messageCreated` events with one cache write per messages cache
 * and one per conversations-list cache, rather than one per event. */
function applyMessagesCreatedBatch(
  queryClient: QueryClient,
  workspaceId: string,
  events: RealtimeEventCreateMessage[],
): void {
  const byConversation = new Map<string, RealtimeEventCreateMessage[]>();
  const incomingList: Message[] = [];
  for (const event of events) {
    const incoming = narrowIncomingMessage(event.data);
    if (!incoming) continue;
    incomingList.push(incoming);
    const group = byConversation.get(incoming.conversationId);
    if (group) group.push(event);
    else byConversation.set(incoming.conversationId, [event]);
  }
  if (incomingList.length === 0) return;

  byConversation.forEach((group, conversationId) => {
    queryClient.setQueryData<InfiniteMessagesData>(
      queryKeys.ws.messages.list(workspaceId, conversationId),
      (old) => group.reduce((acc, event) => applyMessageCreated(acc, event, conversationId), old),
    );
  });

  const activeConversationId = useChatStore.getState().activeConversationId;
  const foundIds = new Set<string>();
  const patchedCaches = patchObservedConversationLists(queryClient, workspaceId, (old) => {
    const result = applyConversationMessagesCreated(old, incomingList, activeConversationId);
    result.foundIds.forEach((id) => foundIds.add(id));
    return result.data;
  });

  if (patchedCaches > 0 && incomingList.some((m) => !foundIds.has(m.conversationId))) {
    debounceInvalidateConversationsList(queryClient, workspaceId);
  }
}

function forEachMessagesCache(
  queryClient: QueryClient,
  workspaceId: string,
  update: (old: InfiniteMessagesData) => InfiniteMessagesData,
): void {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: ['ws', workspaceId, 'messages'] })
    .forEach((query) => {
      queryClient.setQueryData<InfiniteMessagesData>(query.queryKey, update);
    });
}

/** The channel answered for a send: it is no longer awaiting delivery, whichever way it went. */
function settleTrackedSend(ids: { clientId?: string | null; messageId?: string | null }) {
  const store = useSendStatusStore.getState();
  const clientId = findTrackedClientId(store.sends, ids);
  if (clientId) store.stopTracking(clientId);
  return clientId;
}

function applyOtherEvent(
  queryClient: QueryClient,
  workspaceId: string,
  event: Exclude<RealtimeEventData, RealtimeEventCreateMessage>,
): void {
  switch (event.eventType) {
    case RealtimeEventType.messageFailed: {
      settleTrackedSend(event.data);
      forEachMessagesCache(queryClient, workspaceId, (old) => applyMessageFailed(old, event));
      break;
    }

    case RealtimeEventType.messageRemoved: {
      const ownSends = new Map<string, string>();
      for (const messageId of event.data.messageIds) {
        const clientId = settleTrackedSend({ messageId });
        if (clientId) ownSends.set(messageId, clientId);
      }
      forEachMessagesCache(queryClient, workspaceId, (old) =>
        applyMessageRemoved(old, event, ownSends),
      );
      break;
    }

    case RealtimeEventType.messageDeleted:
    case RealtimeEventType.messageUpdated:
    case RealtimeEventType.messageContentUpdated:
    case RealtimeEventType.messageIdAssigned: {
      forEachMessagesCache(queryClient, workspaceId, (old) => {
        switch (event.eventType) {
          case RealtimeEventType.messageDeleted:
            return applyMessageDeleted(old, event);
          case RealtimeEventType.messageUpdated:
            return applyMessageUpdated(old, event);
          case RealtimeEventType.messageContentUpdated:
            return applyMessageContentUpdated(old, event);
          case RealtimeEventType.messageIdAssigned:
            return applyMessageIdAssigned(old, event);
          default:
            return old;
        }
      });
      break;
    }

    case RealtimeEventType.typing: {
      const { conversationId, typing, seconds } = event.data;
      // `getState()` always returns the live store (and zustand actions are stable), which this
      // needs since it also runs from the typing-timer's own expiry closure.
      useChatStore.getState().setTyping(conversationId, typing, seconds);

      if (typing) {
        scheduleTypingExpiry(conversationId, seconds || DEFAULT_TYPING_TTL_SECONDS, () =>
          useChatStore.getState().setTyping(conversationId, false),
        );
      } else {
        clearTypingTimer(conversationId);
      }
      break;
    }

    case RealtimeEventType.conversationAssigned:
    case RealtimeEventType.conversationUpdated:
    case RealtimeEventType.contactBlocked:
    case RealtimeEventType.contactUnblocked: {
      patchObservedConversationLists(queryClient, workspaceId, (old) => {
        switch (event.eventType) {
          case RealtimeEventType.conversationAssigned:
            return applyConversationAssigned(old, event);
          case RealtimeEventType.conversationUpdated:
            return applyConversationUpdated(old, event);
          case RealtimeEventType.contactBlocked:
            return applyContactBlockState(old, event, true);
          case RealtimeEventType.contactUnblocked:
            return applyContactBlockState(old, event, false);
          default:
            return old;
        }
      });

      if (
        event.eventType === RealtimeEventType.contactBlocked ||
        event.eventType === RealtimeEventType.contactUnblocked
      ) {
        const blocked = event.eventType === RealtimeEventType.contactBlocked;
        queryClient
          .getQueryCache()
          .findAll({
            predicate: (query) =>
              query.queryKey[0] === 'ws' &&
              query.queryKey[1] === workspaceId &&
              query.queryKey[2] === 'contacts' &&
              query.queryKey[3] === 'detail' &&
              query.queryKey[4] === event.data.contactId,
          })
          .forEach((query) => {
            queryClient.setQueryData(
              query.queryKey,
              (old: { blockedAt: string | null } | undefined) =>
                applyContactDetailBlockState(old, blocked),
            );
          });
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Dispatches one realtime frame's events to the cache appliers, returning `handleEvents`.
 *
 * A frame larger than `BURST_REFETCH_THRESHOLD` skips per-event patching: the conversations lists
 * are reset (an infinite query refetches just its first page) and the messages caches invalidated.
 * Otherwise the frame runs inside `notifyManager.batch` so observers re-render once, and
 * consecutive `messageCreated` events are applied together (see `applyMessagesCreatedBatch`);
 * any other event type flushes the pending run first so ordering is preserved.
 *
 * `messageCreated` is routed ONLY to the messages-list query matching its own `conversationId`
 * (no cross-conversation leak; `applyMessageCreated`'s guard is defense-in-depth) and also patches
 * the matching conversations-list row so the inbox preview updates live. The other message events
 * match by message id, so they fan out to every cached messages query and no-op where unmatched.
 */
export function useRealtimeHandlers(queryClient: QueryClient, workspaceId: string) {
  return useCallback(
    (events: RealtimeEventData[]) => {
      if (events.length === 0) return;

      if (events.length > BURST_REFETCH_THRESHOLD) {
        void queryClient.resetQueries({ queryKey: conversationsListKey(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: ['ws', workspaceId, 'messages'] });
        return;
      }

      notifyManager.batch(() => {
        let pending: RealtimeEventCreateMessage[] = [];
        const flush = () => {
          if (pending.length === 0) return;
          applyMessagesCreatedBatch(queryClient, workspaceId, pending);
          pending = [];
        };

        for (const event of events) {
          if (event.eventType === RealtimeEventType.messageCreated) {
            pending.push(event);
          } else {
            flush();
            applyOtherEvent(queryClient, workspaceId, event);
          }
        }
        flush();
      });
    },
    [queryClient, workspaceId],
  );
}
