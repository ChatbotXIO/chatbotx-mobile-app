import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { getNextPageParam } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';
import {
  getMessageClientId,
  getOptimisticStatus,
} from '@/features/chat/components/optimistic-message';
import { insertByCreatedAt } from '@/realtime/apply-message-events';

/**
 * Types derived directly from the generated schema's `operations` map for
 * `messages.list` — `GET /v1/conversations/{conversationId}/messages`. Response shape matches api/pagination.ts's `CursorPage<T>` (`{ data, nextCursor, prevCursor }`).
 */
type ListMessagesOperation = operations['messages.list'];
export type ListMessagesResponse =
  ListMessagesOperation['responses'][200]['content']['application/json'];
export type Message = ListMessagesResponse['data'][number];

const PER_PAGE = 30;

export type MessagesInfiniteData = { pages: ListMessagesResponse[]; pageParams: unknown[] };

/**
 * Merges this device's local state into a freshly fetched first page. A refetch only returns what
 * the server holds — and the server never stores `clientId` — so without this:
 * - a local row (a send still in flight, or one that failed and waits for a retry) would vanish;
 * - an own send already matched to its server id (see `reconcileSentMessage`) would lose its
 *   `clientId`, changing its list key and its "sending" lookup in use-send-status-store.ts.
 *
 * A local row is dropped once the fresh page holds its server id (or, should the server ever echo
 * it, its `clientId`), and the `clientId` it had is carried onto the server row.
 */
export function keepLocalRows(
  previous: MessagesInfiniteData | undefined,
  fresh: ListMessagesResponse,
): ListMessagesResponse {
  const previousRows = previous?.pages.flatMap((page) => page.data) ?? [];
  if (previousRows.length === 0) return fresh;

  const clientIdById = new Map<string, string>();
  for (const message of previousRows) {
    const clientId = getMessageClientId(message);
    if (clientId) clientIdById.set(message.id, clientId);
  }

  const freshIds = new Set(fresh.data.map((message) => message.id));
  const freshClientIds = new Set(
    fresh.data.flatMap((message) => getMessageClientId(message) ?? []),
  );
  const localRows = (previous?.pages[0]?.data ?? []).filter((message) => {
    if (getOptimisticStatus(message) === null) return false;
    const clientId = getMessageClientId(message);
    return !freshIds.has(message.id) && !(clientId && freshClientIds.has(clientId));
  });

  let changed = false;
  const data = fresh.data.map((message) => {
    const clientId = getMessageClientId(message) ? undefined : clientIdById.get(message.id);
    if (!clientId) return message;
    changed = true;
    return { ...message, clientId } as Message;
  });
  if (localRows.length === 0 && !changed) return fresh;

  // Newest-first; a kept local row goes where its createdAt puts it, not on top.
  return { ...fresh, data: localRows.reduce(insertByCreatedAt, data) };
}

/** Each page returns newest-first; `nextCursor` walks toward older messages. message-list.tsx
 * reverses pages back into chronological order before rendering (see its own comment — FlashList
 * v2 dropped the `inverted` prop this used to rely on). */
export function useMessagesInfinite(workspaceId: string | null, conversationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ws.messages.list(workspaceId ?? '', conversationId ?? '');
  return useInfiniteQuery({
    queryKey,
    enabled: workspaceId !== null && conversationId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListMessagesResponse> => {
      const { data, error } = await apiClient.GET('/v1/conversations/{conversationId}/messages', {
        params: {
          path: { conversationId: conversationId! },
          query: { cursor: pageParam, perPage: PER_PAGE },
        },
      });
      if (error) {
        throw new ApiError(error);
      }
      if (pageParam !== undefined) return data;
      return keepLocalRows(queryClient.getQueryData<MessagesInfiniteData>(queryKey), data);
    },
    getNextPageParam,
  });
}
