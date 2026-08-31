import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import {
  conversationListPredicate,
  patchConversationListCache,
  rollbackConversationListCache,
  type ConversationListSnapshot,
} from '@/features/conversations/lib/patch-conversation-list-cache';

/**
 * Conversation action mutations, exactly matching the request shapes read from
 * `conversationsAPI.{assignConversations,archiveConversations,unarchiveConversations,enableBot,
 * disableBot,readConversation,unreadConversation,followConversation,unfollowConversation}
 * AuthenticatedAPI` in src/api/generated/schema.ts:
 *
 * - assign: POST /conversations/assign body `{ contactIds: string[], assignedId: string | null }`
 *   — keyed by CONTACT id, not conversation id (per the real schema).
 * - archive/unarchive/enableBot/disableBot: POST .../{action} body `{ ids: string[] }` — batch,
 *   conversation ids.
 * - read/unread/follow/unfollow: POST .../{id}/{action}, path param, no body, single conversation.
 *
 * All apply an optimistic patch across every cached infinite-query page for the conversations
 * list (any filter combination), rolling back on error via the snapshot each mutation captures.
 */

/** Patches `patch` onto the cached conversation-list row matching `conversationId`, across every
 * filter combination for this workspace. Thin wrapper over the shared list-cache patcher. */
function patchConversationInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  conversationId: string,
  patch: Partial<ConversationListItem>,
): ConversationListSnapshot {
  return patchConversationListCache(queryClient, workspaceId, (data) =>
    data.map((item) => (item.id === conversationId ? { ...item, ...patch } : item)),
  );
}

const rollback = rollbackConversationListCache;

/** Cancels every in-flight conversations-list query for this workspace (any filter combination)
 * before an optimistic patch runs, so a refetch that resolves mid-mutation can't clobber the
 * patch with stale server data. */
function cancelConversationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
): Promise<void> {
  return queryClient.cancelQueries({ predicate: conversationListPredicate(workspaceId) });
}

/** Invalidates every conversations-list query for this workspace so the server authoritatively
 * drops/adds the row for whatever filter view is active — used after archive/unarchive succeed. */
function invalidateConversationLists(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
): void {
  queryClient.invalidateQueries({ predicate: conversationListPredicate(workspaceId) });
}

/** The conversation-detail query (`useConversationDetail`) caches a single object under
 * `queryKeys.ws.conversations.detail(...)` — a different shape from the paginated list queries
 * above (`{ pages, pageParams }`). Every list-cache mutation here should also patch the detail
 * query when it's cached for the same conversation, so a screen reading the detail query (chat
 * header, contact-nested route) doesn't go stale relative to the list the user came from. Returns
 * the previous detail data (or undefined if nothing was cached) so callers can roll it back. */
function patchConversationDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  conversationId: string,
  patch: Partial<ConversationListItem>,
) {
  const detailKey = queryKeys.ws.conversations.detail(workspaceId, conversationId);
  const previous = queryClient.getQueryData<ConversationListItem>(detailKey);

  if (previous) {
    queryClient.setQueryData<ConversationListItem>(detailKey, { ...previous, ...patch });
  }

  return { key: detailKey, previous };
}

function rollbackDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: { key: readonly unknown[]; previous: ConversationListItem | undefined } | undefined,
) {
  if (!snapshot || !snapshot.previous) return;
  queryClient.setQueryData(snapshot.key, snapshot.previous);
}

interface SingleActionSnapshot {
  list: ConversationListSnapshot;
  detail: { key: readonly unknown[]; previous: ConversationListItem | undefined };
}

/** Patches both the list cache (every filter combination) and the detail cache for a single
 * conversation id, returning a combined snapshot `onError` can roll back with `rollbackSingle`. */
function patchSingleConversation(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  conversationId: string,
  patch: Partial<ConversationListItem>,
): SingleActionSnapshot {
  return {
    list: patchConversationInCache(queryClient, workspaceId, conversationId, patch),
    detail: patchConversationDetail(queryClient, workspaceId, conversationId, patch),
  };
}

function rollbackSingle(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: SingleActionSnapshot | undefined,
) {
  if (!snapshot) return;
  rollback(queryClient, snapshot.list);
  rollbackDetail(queryClient, snapshot.detail);
}

export function useMarkConversationRead(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await apiClient.POST('/workspaces/{workspaceId}/conversations/{id}/read', {
        params: { path: { workspaceId, id: conversationId } },
      });
      if (error) throw new ApiError(error);
    },
    onMutate: async (conversationId) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchSingleConversation(queryClient, workspaceId, conversationId, {
        agentLastReadAt: new Date().toISOString(),
      });
    },
    onError: (_err, _vars, snapshot) => rollbackSingle(queryClient, snapshot),
  });
}

export function useMarkConversationUnread(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await apiClient.POST(
        '/workspaces/{workspaceId}/conversations/{id}/unread',
        {
          params: { path: { workspaceId, id: conversationId } },
        },
      );
      if (error) throw new ApiError(error);
    },
    onMutate: async (conversationId) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchSingleConversation(queryClient, workspaceId, conversationId, {
        agentLastReadAt: null,
      });
    },
    onError: (_err, _vars, snapshot) => rollbackSingle(queryClient, snapshot),
  });
}

export function useFollowConversation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await apiClient.POST(
        '/workspaces/{workspaceId}/conversations/{id}/follow',
        {
          params: { path: { workspaceId, id: conversationId } },
        },
      );
      if (error) throw new ApiError(error);
    },
    onMutate: async (conversationId) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchSingleConversation(queryClient, workspaceId, conversationId, { followed: true });
    },
    onError: (_err, _vars, snapshot) => rollbackSingle(queryClient, snapshot),
  });
}

export function useUnfollowConversation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await apiClient.POST(
        '/workspaces/{workspaceId}/conversations/{id}/unfollow',
        {
          params: { path: { workspaceId, id: conversationId } },
        },
      );
      if (error) throw new ApiError(error);
    },
    onMutate: async (conversationId) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchSingleConversation(queryClient, workspaceId, conversationId, {
        followed: false,
      });
    },
    onError: (_err, _vars, snapshot) => rollbackSingle(queryClient, snapshot),
  });
}

/** Batch actions (archive/unarchive/bot toggle) patch every affected id in cache — both the list
 * cache (every filter combination) and the detail cache — since the backend accepts a batch but
 * the UI here always calls with a single-id array (swipe/long-press actions) — batching UI is a
 * later concern if ever needed. `onSettledIds` runs after the mutation settles (success or
 * error) with the affected ids, for callers that need a side effect beyond the optimistic patch
 * (e.g. `useDisableBot` invalidating the detail query so the server-computed `botResumeAt`
 * arrives). */
function useBatchConversationAction(
  workspaceId: string,
  path:
    | '/workspaces/{workspaceId}/conversations/archive'
    | '/workspaces/{workspaceId}/conversations/unarchive'
    | '/workspaces/{workspaceId}/conversations/enable-bot'
    | '/workspaces/{workspaceId}/conversations/disable-bot',
  buildPatch: () => Partial<ConversationListItem>,
  onSuccessIds?: (queryClient: ReturnType<typeof useQueryClient>, ids: string[]) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await apiClient.POST(path, {
        params: { path: { workspaceId } },
        body: { ids },
      });
      if (error) throw new ApiError(error);
    },
    onMutate: async (ids: string[]) => {
      await cancelConversationQueries(queryClient, workspaceId);
      const patch = buildPatch();
      return ids.map((id) => patchSingleConversation(queryClient, workspaceId, id, patch));
    },
    onError: (_err, _vars, snapshots) => {
      snapshots?.forEach((snapshot) => rollbackSingle(queryClient, snapshot));
    },
    onSuccess: (_data, ids) => onSuccessIds?.(queryClient, ids),
  });
}

/** The backend excludes archived rows from the default list view (and shows only archived rows in
 * the archived view), so the optimistic `archivedAt` patch alone can't move a row in or out of
 * whichever filter view is currently active — it stays for instant feedback, but once the mutation
 * succeeds the list queries are invalidated so the server authoritatively drops/adds the row. */
export function useArchiveConversations(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    '/workspaces/{workspaceId}/conversations/archive',
    () => ({ archivedAt: new Date().toISOString() }),
    (queryClient) => invalidateConversationLists(queryClient, workspaceId),
  );
}

export function useUnarchiveConversations(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    '/workspaces/{workspaceId}/conversations/unarchive',
    () => ({ archivedAt: null }),
    (queryClient) => invalidateConversationLists(queryClient, workspaceId),
  );
}

export function useEnableBot(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    '/workspaces/{workspaceId}/conversations/enable-bot',
    () => ({ botEnabled: true }),
  );
}

/** Disabling the bot triggers a 24h server-side pause (`botResumeAt`) — the optimistic patch above
 * only knows `botEnabled: false`, it can't predict the server-computed resume timestamp. Once the
 * mutation succeeds, invalidate the detail query for each affected conversation so a refetch
 * brings in the real `botResumeAt` (used by `isBotActive` to show "paused until…" rather than
 * just "off"). The list cache is left as-is here — it already shows a reasonable "not handled by
 * bot" state from the optimistic patch, and invalidating N list queries on every disable is
 * unnecessary churn; the detail query is what chat-header and contact screens read closely. */
export function useDisableBot(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    '/workspaces/{workspaceId}/conversations/disable-bot',
    () => ({ botEnabled: false }),
    (queryClient, ids) => {
      ids.forEach((id) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ws.conversations.detail(workspaceId, id),
        });
      });
    },
  );
}

/** Patches `assignedUserId` on every cached conversation row whose `contactId` is in the given
 * set — assign is keyed by contact, not conversation, so a contact can back multiple
 * conversations (e.g. across channels) that all need the same optimistic update. */
function patchAssignedUserByContact(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  contactIds: string[],
  assignedId: string | null,
): ConversationListSnapshot {
  const contactIdSet = new Set(contactIds);

  return patchConversationListCache(queryClient, workspaceId, (data) =>
    data.map((item) =>
      contactIdSet.has(item.contactId) ? { ...item, assignedUserId: assignedId } : item,
    ),
  );
}

/** Assign is keyed by CONTACT id (not conversation id) per the real schema — pass the
 * conversation's `contactId` field, and `assignedId: null` to unassign. */
export function useAssignConversations(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      assignedId,
    }: {
      contactIds: string[];
      assignedId: string | null;
    }) => {
      const { error } = await apiClient.POST('/workspaces/{workspaceId}/conversations/assign', {
        params: { path: { workspaceId } },
        body: { contactIds, assignedId },
      });
      if (error) throw new ApiError(error);
    },
    onMutate: async ({ contactIds, assignedId }) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchAssignedUserByContact(queryClient, workspaceId, contactIds, assignedId);
    },
    onError: (_err, _vars, snapshot) => snapshot && rollback(queryClient, snapshot),
  });
}
