import { useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { flattenPages, getNextPageParam } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * Types derived directly from the generated schema's `operations` map for
 * `messagesAPI.listMessagesAuthenticatedAPI` — `GET /workspaces/{workspaceId}/messages` with
 * `conversationId` as a QUERY param (not path-nested, unlike message create/edit/delete). Response
 * shape matches api/pagination.ts's `CursorPage<T>` (`{ data, nextCursor, prevCursor }`).
 */
type ListMessagesOperation = operations['messagesAPI.listMessagesAuthenticatedAPI'];
export type ListMessagesResponse =
  ListMessagesOperation['responses'][200]['content']['application/json'];
export type Message = ListMessagesResponse['data'][number];

const PER_PAGE = 30;

/** Each page returns newest-first; `nextCursor` walks toward older messages. message-list.tsx
 * reverses pages back into chronological order before rendering (see its own comment — FlashList
 * v2 dropped the `inverted` prop this used to rely on). */
export function useMessagesInfinite(workspaceId: string | null, conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.ws.messages.list(workspaceId ?? '', conversationId ?? ''),
    enabled: workspaceId !== null && conversationId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListMessagesResponse> => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/messages', {
        params: {
          path: { workspaceId: workspaceId! },
          query: { conversationId: conversationId!, cursor: pageParam, perPage: PER_PAGE },
        },
      });
      if (error) {
        throw new ApiError(error);
      }
      return data;
    },
    getNextPageParam,
  });
}

export function flattenMessagePages(pages: ListMessagesResponse[] | undefined): Message[] {
  return flattenPages(pages);
}
