import type { QueryClient } from '@tanstack/react-query';

import { isWorkspaceQuery } from '@/api/query-keys';
import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

type InfiniteData = { pages: ListConversationsResponse[]; pageParams: unknown[] };

export type ConversationListSnapshot = Map<readonly unknown[], InfiniteData | undefined>;

/** Matches every paginated conversations-list query for this workspace (any filter combination) —
 * shared by every cache-patching helper below and by `cancelConversationQueries` (call before an
 * optimistic patch so a refetch that resolves mid-mutation can't clobber it). */
export function conversationListPredicate(workspaceId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    isWorkspaceQuery(query.queryKey, workspaceId) &&
    query.queryKey[2] === 'conversations' &&
    query.queryKey[3] === 'list';
}

/**
 * Shared skeleton behind every conversations-list cache patch: snapshot each matching query,
 * then replace its data with `old.pages.map(page => ({ ...page, data: mapItem(page.data) }))`.
 * `mapItem` receives a whole page's row array so callers can map (`use-conversation-actions.ts`'s
 * per-id/per-contact patches), filter (removing rows for a deleted contact), or both in one pass —
 * a single seam covers every shape callers need instead of a map-only helper plus a bolted-on
 * filter variant.
 *
 * Returns the pre-patch snapshot so callers can roll back via `rollbackConversationListCache` on
 * mutation error.
 */
export function patchConversationListCache(
  queryClient: QueryClient,
  workspaceId: string,
  mapItem: (data: ConversationListItem[]) => ConversationListItem[],
): ConversationListSnapshot {
  const previous: ConversationListSnapshot = new Map();

  queryClient
    .getQueryCache()
    // `queryKey[3] === 'list'` (via `conversationListPredicate`) narrows this to the paginated
    // list queries specifically — the detail query lives under the same
    // `['ws', id, 'conversations', ...]` prefix but as
    // `['ws', id, 'conversations', 'detail', conversationId]` with a single-object cache shape
    // (`{ pages, data }` doesn't apply), so without this check `.pages.map(...)` below throws
    // whenever a detail query happens to be cached for the same workspace.
    .findAll({ predicate: conversationListPredicate(workspaceId) })
    .forEach((query) => {
      previous.set(query.queryKey, query.state.data as InfiniteData | undefined);
      queryClient.setQueryData<InfiniteData>(query.queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: mapItem(page.data),
          })),
        };
      });
    });

  return previous;
}

export function rollbackConversationListCache(
  queryClient: QueryClient,
  snapshot: ConversationListSnapshot,
): void {
  snapshot.forEach((data, key) => {
    queryClient.setQueryData(key, data);
  });
}
