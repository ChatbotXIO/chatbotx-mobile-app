import type { QueryClient } from '@tanstack/react-query';

import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

/**
 * Scans every cached conversations-list infinite query (any filter combination) for a row
 * matching `conversationId`. Extracted from the chat screen's previous inline cache scan so it can
 * be reused as `placeholderData` for a conversation-detail query without duplicating the
 * predicate/flatMap logic — both `[conversationId]/index.tsx` (mark-read guard) and
 * `chat-header.tsx` (identity placeholder) call this directly today.
 *
 * Conversation header/preview data in this app generally comes from whichever list page the user
 * navigated from, rather than a dedicated detail fetch — this is the reusable form of that lookup.
 */
export function findConversationInListCache(
  queryClient: QueryClient,
  workspaceId: string,
  conversationId: string,
): ConversationListItem | undefined {
  return queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        query.queryKey[0] === 'ws' &&
        query.queryKey[1] === workspaceId &&
        query.queryKey[2] === 'conversations' &&
        query.queryKey[3] === 'list',
    })
    .flatMap((query) => {
      const data = query.state.data as { pages: ListConversationsResponse[] } | undefined;
      return data?.pages.flatMap((page) => page.data) ?? [];
    })
    .find((item) => item.id === conversationId);
}
