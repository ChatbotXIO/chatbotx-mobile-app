import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { ListMessagesResponse, Message } from './use-messages-infinite';

/**
 * Message edit/delete/like/hide, matching the exact request shapes read from
 * `messagesAPI.{editMessage,deleteMessage,changeMessageAttributes}AuthenticatedAPI` in
 * src/api/generated/schema.ts:
 * - edit: PATCH .../messages/{messageId} body `{ createdAt, newText, newAttachmentPath?,
 *   newAttachmentPublicUrl?, newAttachmentMimeType?, newAttachmentName?, newAttachmentSize?,
 *   removeAttachment? }` — text-only edit here, attachment-replace is out of scope for this phase.
 * - delete: DELETE .../messages/{id} body `{ createdAt }`.
 * - like/hide: POST .../messages/{messageId}/attributes body `{ createdAt, liked?, hidden? }` —
 *   this endpoint IS the like/hide mechanism (no separate dedicated endpoints exist).
 *
 * All three require `createdAt` in the body alongside the path id — the messages table is
 * evidently keyed/partitioned by (id, createdAt), not id alone.
 */

function patchMessageInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  messageId: string,
  patch: Partial<Message>,
) {
  queryClient.setQueryData<{ pages: ListMessagesResponse[]; pageParams: unknown[] }>(
    queryKey,
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((message) =>
            message.id === messageId ? { ...message, ...patch } : message,
          ),
        })),
      };
    },
  );
}

function findCachedMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  messageId: string,
): Message | undefined {
  const data = queryClient.getQueryData<{ pages: ListMessagesResponse[] }>(queryKey);
  for (const page of data?.pages ?? []) {
    const found = page.data.find((message) => message.id === messageId);
    if (found) return found;
  }
  return undefined;
}

export function useEditMessage(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ws.messages.list(workspaceId, conversationId);

  return useMutation({
    mutationFn: async (params: { messageId: string; createdAt: string; newText: string }) => {
      const { error } = await apiClient.PATCH(
        '/workspaces/{workspaceId}/conversations/{conversationId}/messages/{messageId}',
        {
          params: { path: { workspaceId, conversationId, messageId: params.messageId } },
          body: { createdAt: params.createdAt, newText: params.newText },
        },
      );
      if (error) throw new ApiError(error);
    },
    onMutate: (params) => {
      const previous = findCachedMessage(queryClient, queryKey, params.messageId);
      patchMessageInCache(queryClient, queryKey, params.messageId, { text: params.newText });
      return { previous };
    },
    onError: (_error, params, context) => {
      if (!context?.previous) return;
      patchMessageInCache(queryClient, queryKey, params.messageId, { text: context.previous.text });
    },
  });
}

export function useDeleteMessage(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ws.messages.list(workspaceId, conversationId);

  return useMutation({
    mutationFn: async (params: { messageId: string; createdAt: string }) => {
      const { error } = await apiClient.DELETE(
        '/workspaces/{workspaceId}/conversations/{conversationId}/messages/{id}',
        {
          params: { path: { workspaceId, conversationId, id: params.messageId } },
          body: { createdAt: params.createdAt },
        },
      );
      if (error) throw new ApiError(error);
    },
    onMutate: (params) =>
      patchMessageInCache(queryClient, queryKey, params.messageId, {
        deletedAt: new Date().toISOString(),
      }),
  });
}

/** No optimistic cache patch here (unlike edit/delete above) — `attributes` is a loose JSON-value
 * union in the generated schema with no reliable current-liked/hidden shape to read or merge into,
 * so this just fires the mutation and lets the next list refetch reflect the change. */
export function useSetMessageAttributes(workspaceId: string, conversationId: string) {
  return useMutation({
    mutationFn: async (params: {
      messageId: string;
      createdAt: string;
      liked?: boolean;
      hidden?: boolean;
    }) => {
      const { error } = await apiClient.POST(
        '/workspaces/{workspaceId}/conversations/{conversationId}/messages/{messageId}/attributes',
        {
          params: { path: { workspaceId, conversationId, messageId: params.messageId } },
          body: { createdAt: params.createdAt, liked: params.liked, hidden: params.hidden },
        },
      );
      if (error) throw new ApiError(error);
    },
  });
}
