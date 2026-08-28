import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { isUnread } from '@/features/conversations/lib/conversation-status';
import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

/**
 * Counts unread conversations across every currently CACHED conversations-list page for the given
 * workspace, deduplicated by conversation id (the same conversation can appear in more than one
 * cached filter combination — e.g. "All" and "Unread" — and must only count once).
 *
 * LIMITATION: this only sees pages TanStack Query already has in cache (whatever's been scrolled
 * into view / fetched this session) — it is NOT a true server-side unread total. A conversation
 * that's unread but was never fetched into any cached list page (e.g. page 3 the user hasn't
 * scrolled to yet) is invisible to this count. There is no unread-count endpoint on the backend
 * yet — this is the best available approximation until one exists.
 * `Badge`'s own count-mode caps display at "99+", so no separate capping is needed here.
 */
function countUnreadFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
): number {
  if (!workspaceId) return 0;

  const seen = new Map<string, ConversationListItem>();

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
      const data = query.state.data as { pages: ListConversationsResponse[] } | undefined;
      data?.pages.forEach((page) => {
        page.data.forEach((item) => {
          seen.set(item.id, item);
        });
      });
    });

  let count = 0;
  seen.forEach((conversation) => {
    if (isUnread(conversation)) count += 1;
  });
  return count;
}

/** Subscribes to the query cache and recomputes the unread count on every cache change — used for
 * the Inbox tab's `tabBarBadge`. `useSyncExternalStore` (rather than a `useQuery`/`useEffect`
 * combo) is the correct primitive here since the "data" being read isn't a query result itself,
 * it's a derived aggregate over however many list queries currently happen to be cached. */
export function useInboxUnreadCount(workspaceId: string | null): number {
  const queryClient = useQueryClient();

  return useSyncExternalStore(
    (onStoreChange) => queryClient.getQueryCache().subscribe(onStoreChange),
    () => countUnreadFromCache(queryClient, workspaceId ?? ''),
    () => 0,
  );
}
