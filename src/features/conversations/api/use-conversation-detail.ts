import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

interface UseConversationDetailOptions {
  /** Synchronous placeholder resolver — e.g. `findConversationInListCache` — so a screen that
   * navigated here from a list already showing this conversation can render instantly instead of
   * flashing a "Conversation" fallback while the detail fetch is in flight (the bug this option
   * exists to fix: a deep link straight into a conversation had no list cache to fall back on,
   * and previously showed a hardcoded fallback name for the whole first fetch). */
  placeholderData?: () => ConversationListItem | undefined;
}

/** `conversationsAPI.findConversationAuthenticatedAPI` — `GET /workspaces/{workspaceId}/conversations/{id}`.
 * Used by the conversation-nested contact route to resolve `contactId` before rendering the shared
 * ContactPanel (that route is keyed by conversationId, not contactId), and by the chat header to
 * render conversation identity (name/channel/assignee/bot state) with an optional list-cache
 * placeholder while the real fetch is in flight. */
export function useConversationDetail(
  workspaceId: string | null,
  conversationId: string | null,
  options: UseConversationDetailOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.ws.conversations.detail(workspaceId ?? '', conversationId ?? ''),
    enabled: workspaceId !== null && conversationId !== null,
    placeholderData: options.placeholderData,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/conversations/{id}', {
        params: { path: { workspaceId: workspaceId!, id: conversationId! } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}
