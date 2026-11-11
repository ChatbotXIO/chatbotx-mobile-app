import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { BOT_PAUSE_DURATION_MS } from '@/features/conversations/lib/conversation-status';
import {
  conversationListPredicate,
  patchConversationListCache,
  rollbackConversationListCache,
  type ConversationListSnapshot,
} from '@/features/conversations/lib/patch-conversation-list-cache';

/** Thrown when a multi-conversation action fails for some or all ids. `failedIds` lets callers
 * roll back and report only what actually failed. */
class BatchActionError extends Error {
  constructor(
    readonly failedIds: string[],
    readonly total: number,
    readonly cause?: unknown,
  ) {
    super(`${failedIds.length} of ${total} conversation actions failed`);
    this.name = 'BatchActionError';
  }
}

/**
 * Conversation action mutations against the `/v1/conversations/{id}/{action}` operations:
 *
 * - assign: PUT-style POST body `{ assignedId: 'u_<userId>' | 't_<teamId>' | null }`, per conversation.
 * - archive/unarchive/enableBot/disableBot/read/unread/follow/unfollow: no body, per conversation.
 *
 * The API has no batch variants, so multi-id actions run one request per id and report partial
 * failure via `BatchActionError`. All apply an optimistic patch across every cached infinite-query
 * page for the conversations list (any filter combination), rolling back the failed ids on error.
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
      const { error } = await apiClient.POST('/v1/conversations/{id}/read', {
        params: { path: { id: conversationId } },
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
      const { error } = await apiClient.POST('/v1/conversations/{id}/unread', {
        params: { path: { id: conversationId } },
      });
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
      const { error } = await apiClient.POST('/v1/conversations/{id}/follow', {
        params: { path: { id: conversationId } },
      });
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
      const { error } = await apiClient.POST('/v1/conversations/{id}/unfollow', {
        params: { path: { id: conversationId } },
      });
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
 * the UI here always calls with a single-id array (long-press actions sheet) — batching UI is a
 * later concern if ever needed. `onSettledIds` runs after the mutation settles (success or
 * error) with the affected ids, for callers that need a side effect beyond the optimistic patch
 * (e.g. the bot toggles invalidating the detail query to resync with the server). */
function useBatchConversationAction(
  workspaceId: string,
  action: 'archive' | 'unarchive' | 'enable-bot' | 'disable-bot',
  buildPatch: () => Partial<ConversationListItem>,
  onSuccessIds?: (queryClient: ReturnType<typeof useQueryClient>, ids: string[]) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const { error } = await apiClient.POST(`/v1/conversations/{id}/${action}`, {
            params: { path: { id } },
          });
          if (error) throw new ApiError(error);
        }),
      );
      const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
      if (failedIds.length > 0) {
        const firstRejection = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        throw new BatchActionError(failedIds, ids.length, firstRejection?.reason);
      }
    },
    onMutate: async (ids: string[]) => {
      await cancelConversationQueries(queryClient, workspaceId);
      const patch = buildPatch();
      return ids.map((id) => ({
        id,
        snapshot: patchSingleConversation(queryClient, workspaceId, id, patch),
      }));
    },
    onError: (err, ids, snapshots) => {
      // Only ids that actually failed are rolled back; the ones that succeeded keep their patch.
      const failed = err instanceof BatchActionError ? new Set(err.failedIds) : new Set(ids);
      snapshots?.forEach(({ id, snapshot }) => {
        if (failed.has(id)) rollbackSingle(queryClient, snapshot);
      });
      if (err instanceof BatchActionError && err.failedIds.length < ids.length) {
        invalidateConversationLists(queryClient, workspaceId);
      }
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
    'archive',
    () => ({ archivedAt: new Date().toISOString() }),
    (queryClient) => invalidateConversationLists(queryClient, workspaceId),
  );
}

export function useUnarchiveConversations(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    'unarchive',
    () => ({ archivedAt: null }),
    (queryClient) => invalidateConversationLists(queryClient, workspaceId),
  );
}

/** Invalidates the detail query for each id so the chat header/contact screens resync with the
 * server after a bot toggle. The list cache is left as-is — the optimistic patch already matches
 * what the server writes, and invalidating every list query on each toggle is needless churn. */
function invalidateConversationDetails(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  ids: string[],
): void {
  ids.forEach((id) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.ws.conversations.detail(workspaceId, id),
    });
  });
}

/** Enabling the bot clears any pending auto-resume server-side (`botResumeAt: null`), so the
 * optimistic patch clears it too — otherwise a leftover future `botResumeAt` would keep the
 * conversation reading as inactive until the next refetch. */
export function useEnableBot(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    'enable-bot',
    () => ({ botEnabled: true, botResumeAt: null }),
    (queryClient, ids) => invalidateConversationDetails(queryClient, workspaceId, ids),
  );
}

/** Disabling the bot sets a server-side auto-resume `BOT_PAUSE_DURATION_MS` from now. The
 * optimistic patch approximates that timestamp locally so `isBotActive` reports inactive right
 * away; the detail refetch on success then brings in the exact server value. */
export function useDisableBot(workspaceId: string) {
  return useBatchConversationAction(
    workspaceId,
    'disable-bot',
    () => ({
      botEnabled: false,
      botResumeAt: new Date(Date.now() + BOT_PAUSE_DURATION_MS).toISOString(),
    }),
    (queryClient, ids) => invalidateConversationDetails(queryClient, workspaceId, ids),
  );
}

/** Patches `assignedUserId` on every cached conversation row in the given set of conversation ids. */
function patchAssignedUserByConversation(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  conversationIds: string[],
  assignedId: string | null,
): ConversationListSnapshot {
  const idSet = new Set(conversationIds);

  return patchConversationListCache(queryClient, workspaceId, (data) =>
    data.map((item) => (idSet.has(item.id) ? { ...item, assignedUserId: assignedId } : item)),
  );
}

/** Assign is keyed by CONVERSATION id. `assignedId` is a plain user id (or `null` to unassign); the
 * API's `u_<userId>` wire format is applied here so callers and the optimistic patch keep working
 * with raw user ids. */
export function useAssignConversations(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      assignedId,
    }: {
      conversationIds: string[];
      assignedId: string | null;
    }) => {
      const results = await Promise.allSettled(
        conversationIds.map(async (id) => {
          const { error } = await apiClient.POST('/v1/conversations/{id}/assign', {
            params: { path: { id } },
            body: { assignedId: assignedId === null ? null : `u_${assignedId}` },
          });
          if (error) throw new ApiError(error);
        }),
      );
      const failedIds = conversationIds.filter((_, index) => results[index]?.status === 'rejected');
      if (failedIds.length > 0) {
        const firstRejection = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        throw new BatchActionError(failedIds, conversationIds.length, firstRejection?.reason);
      }
    },
    onMutate: async ({ conversationIds, assignedId }) => {
      await cancelConversationQueries(queryClient, workspaceId);
      return patchAssignedUserByConversation(queryClient, workspaceId, conversationIds, assignedId);
    },
    onError: (_err, _vars, snapshot) => snapshot && rollback(queryClient, snapshot),
  });
}
