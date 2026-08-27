import type { QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '@/api/query-keys';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { narrowIncomingMessage, type InfiniteMessagesData } from './apply-message-events';
import {
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageFailed,
  applyMessageIdAssigned,
  applyMessageUpdated,
} from './apply-message-events';
import type { InfiniteConversationsData } from './apply-conversation-events';
import {
  applyConversationMessageCreated,
  applyContactBlockState,
  applyContactDetailBlockState,
  applyConversationAssigned,
  applyConversationUpdated,
} from './apply-conversation-events';
import { scheduleTypingExpiry, clearTypingTimer } from './typing-timers';
import { RealtimeEventType, type RealtimeEventData } from './events';

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

/**
 * Dispatches a parsed realtime event to the right cache applier.
 *
 * `messageCreated` is special-cased: it's routed ONLY to the one messages-list query key matching
 * its own `conversationId` (rather than fanning out to every cached messages query like the other
 * message events below) — this is the actual fix for the cross-conversation leak where a message
 * from conversation A could get prepended into conversation B's cache if both happened to be
 * cached simultaneously. `applyMessageCreated`'s own `targetConversationId` guard is
 * defense-in-depth on top of this. It also patches the conversations-list ROW for the same
 * conversation via `applyConversationMessageCreated` so the inbox preview updates live.
 *
 * The other message events (`messageDeleted`/`messageUpdated`/`messageFailed`/
 * `messageIdAssigned`) match by message id already, so fanning out to every cached messages query
 * and letting each applier no-op on a non-matching cache is safe and is left unchanged.
 *
 * Conversation events patch every cached conversations-list query (any filter combination) for
 * this workspace, same as Phase 3's action-mutation cache patches.
 */
export function useRealtimeHandlers(queryClient: QueryClient, workspaceId: string) {
  return useCallback(
    (event: RealtimeEventData) => {
      switch (event.eventType) {
        case RealtimeEventType.messageCreated: {
          const incoming = narrowIncomingMessage(event.data);
          if (!incoming) break;

          queryClient.setQueryData<InfiniteMessagesData>(
            queryKeys.ws.messages.list(workspaceId, incoming.conversationId),
            (old) => applyMessageCreated(old, event, incoming.conversationId),
          );

          let foundInAnyPage = false;
          queryClient
            .getQueryCache()
            .findAll({
              predicate: (query) =>
                query.queryKey[0] === 'ws' &&
                query.queryKey[1] === workspaceId &&
                query.queryKey[2] === 'conversations' &&
                query.queryKey[3] === 'list',
            })
            .forEach((query) => {
              queryClient.setQueryData<InfiniteConversationsData>(query.queryKey, (old) => {
                const result = applyConversationMessageCreated(old, event);
                if (result.found) foundInAnyPage = true;
                return result.data;
              });
            });

          if (!foundInAnyPage) {
            debounceInvalidateConversationsList(queryClient, workspaceId);
          }
          break;
        }

        case RealtimeEventType.messageDeleted:
        case RealtimeEventType.messageUpdated:
        case RealtimeEventType.messageFailed:
        case RealtimeEventType.messageIdAssigned: {
          queryClient
            .getQueryCache()
            .findAll({
              predicate: (query) =>
                query.queryKey[0] === 'ws' &&
                query.queryKey[1] === workspaceId &&
                query.queryKey[2] === 'messages',
            })
            .forEach((query) => {
              queryClient.setQueryData<InfiniteMessagesData>(query.queryKey, (old) => {
                switch (event.eventType) {
                  case RealtimeEventType.messageDeleted:
                    return applyMessageDeleted(old, event);
                  case RealtimeEventType.messageUpdated:
                    return applyMessageUpdated(old, event);
                  case RealtimeEventType.messageFailed:
                    return applyMessageFailed(old, event);
                  case RealtimeEventType.messageIdAssigned:
                    return applyMessageIdAssigned(old, event);
                  default:
                    return old;
                }
              });
            });
          break;
        }

        case RealtimeEventType.typing: {
          const { conversationId, typing, seconds } = event.data;
          // Read via `getState()` rather than a hook-selected value: this callback is memoized by
          // `useCallback` below (deps: queryClient/workspaceId only) and also invoked from the
          // typing-timer's own expiry closure, so it needs the CURRENT store action each time it
          // runs rather than one captured at a particular render — `getState()` always returns the
          // live store, zustand action references are stable, so this is safe outside React.
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
          queryClient
            .getQueryCache()
            .findAll({
              predicate: (query) =>
                query.queryKey[0] === 'ws' &&
                query.queryKey[1] === workspaceId &&
                query.queryKey[2] === 'conversations' &&
                query.queryKey[3] === 'list',
            })
            .forEach((query) => {
              queryClient.setQueryData<InfiniteConversationsData>(query.queryKey, (old) => {
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

        case RealtimeEventType.conversationCreated: {
          // Untyped payload — invalidate rather than splice (see apply-conversation-events.ts).
          queryClient.invalidateQueries({ queryKey: ['ws', workspaceId, 'conversations', 'list'] });
          break;
        }

        case RealtimeEventType.notifyExportResult:
          // No UI surface for export jobs on mobile yet — intentionally ignored.
          break;

        default:
          break;
      }
    },
    [queryClient, workspaceId],
  );
}
