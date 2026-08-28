import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { generateClientId } from './generate-client-id';
import type { ListMessagesResponse, Message } from './use-messages-infinite';
import { type MultipartAttachment, sendMultipartMessage } from './send-message-multipart';

interface SendMessageParams {
  workspaceId: string;
  conversationId: string;
  text?: string;
  attachments?: MultipartAttachment[];
  /** Pass the same clientId back in to retry a failed send instead of creating a new pending
   * bubble — see composer.tsx / message-bubble.tsx retry handler. */
  clientId?: string;
  /** Send-a-flow: the server emits N messages for the flow's own steps via realtime rather than
   * echoing a single created message, so `onMutate` skips the optimistic bubble entirely when this
   * is set (see below). Mutually exclusive with `attachments` — flows don't take file uploads. */
  flowId?: string;
  nodeId?: string;
  replyTo?: { messageId: string; createdAt: string };
}

export const MAX_FILE_SIZE_BYTES = 5 * 1000 * 1000;

export class AttachmentTooLargeError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is larger than 5MB.`);
    this.name = 'AttachmentTooLargeError';
  }
}

/** Maps a locally-picked file into the SERVER attachment shape so the optimistic bubble can render
 * a preview through the normal `AttachmentView` path. `url` points at the local `file://` URI —
 * expo-image renders that identically to a remote URL, so no preview-specific rendering code is
 * needed. Server-only metadata we can't know yet (`size`, `width`, `height`) is zero/null and is
 * not read by any render path; the real values arrive when the send is confirmed. */
function toOptimisticAttachment(
  attachment: MultipartAttachment,
  clientId: string,
  index: number,
  now: string,
): Message['attachments'][number] {
  return {
    // Unique + stable: AttachmentView uses `id` as its React key, and it must not collide across
    // retries of the same message (which reuse the clientId).
    id: `optimistic-${clientId}-${index}`,
    createdAt: now,
    updatedAt: now,
    messageCreatedAt: now,
    fileType: attachment.mimeType.startsWith('image/') ? 'image' : 'file',
    sourceId: null,
    mimeType: attachment.mimeType,
    width: null,
    height: null,
    size: 0,
    thumbnailPath: null,
    originPath: attachment.uri,
    name: attachment.fileName,
    url: attachment.uri,
  };
}

/** Builds a STRUCTURALLY COMPLETE `Message` for the optimistic bubble. This entry goes straight
 * into the query cache's real `Message[]`, so every field message-bubble.tsx reads must be present
 * — notably `attachments`, whose absence previously crashed the chat screen on every send
 * (`message.attachments.length` on undefined). Deliberately NOT cast: the return type is checked
 * against `Message`, so a future schema change that adds a required field fails the build here
 * instead of at runtime on-device. */
export function createOptimisticMessage(params: {
  clientId: string;
  conversationId: string;
  workspaceId: string;
  text?: string;
  attachments?: MultipartAttachment[];
  parentId?: string | null;
}): Message {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${params.clientId}`,
    clientId: params.clientId,
    createdAt: now,
    updatedAt: now,
    conversationId: params.conversationId,
    workspaceId: params.workspaceId,
    // Not known client-side; unread by any render path.
    contactInboxId: '',
    text: params.text ?? null,
    contentAttributes: null,
    // Non-'contact' senderType keeps the bubble on the outbound (right) side — see isOutbound()
    // in message-bubble.tsx.
    messageType: 'outgoing',
    contentType: 'text',
    senderType: 'user',
    sourceId: null,
    deletedAt: null,
    type: 'message',
    parentId: params.parentId ?? null,
    attributes: null,
    sendError: null,
    attachments: (params.attachments ?? []).map((attachment, index) =>
      toOptimisticAttachment(attachment, params.clientId, index, now),
    ),
  };
}

/** Response body from message-create is typed `unknown` in the generated schema (openapi-typescript
 * couldn't resolve the handler's real return type) — the backend almost certainly echoes the
 * created message (with server `id` and the `clientId` we sent), but this is not contractually
 * guaranteed, so we narrow defensively rather than casting blindly. */
function parseCreatedMessageId(body: unknown): string | null {
  if (body && typeof body === 'object' && 'id' in body && typeof body.id === 'string') {
    return body.id;
  }
  return null;
}

type MessagesInfiniteData = { pages: ListMessagesResponse[]; pageParams: unknown[] };

function removeOptimisticMessageFromData(
  old: MessagesInfiniteData | undefined,
  clientId: string,
): MessagesInfiniteData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: page.data.filter(
        (message) => !('clientId' in message && message.clientId === clientId),
      ),
    })),
  };
}

/** Strips an optimistic entry out of the messages cache entirely — used (unlike the "leave it as
 * a failed bubble, tap to retry" default path) for rejections that mean the send fundamentally
 * cannot go through in this workspace state (`workspaceBlocked`, `unauthorized`), where leaving a
 * perpetually-failed bubble around would be misleading. */
export function removeOptimisticMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  clientId: string,
): void {
  queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) =>
    removeOptimisticMessageFromData(old, clientId),
  );
}

export function useSendMessage(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ws.messages.list(workspaceId, conversationId);
  const setUploadProgress = useChatStore((state) => state.setUploadProgress);
  const clearUploadProgress = useChatStore((state) => state.clearUploadProgress);
  const setDraft = useChatStore((state) => state.setDraft);
  const setJustSentClientId = useChatStore((state) => state.setJustSentClientId);

  const mutation = useMutation({
    mutationFn: async (params: SendMessageParams & { clientId: string }) => {
      const { clientId } = params;
      const attachments = params.attachments ?? [];

      if (attachments.length > 0) {
        const body = await sendMultipartMessage({
          workspaceId,
          conversationId,
          text: params.text,
          clientId,
          attachments,
          replyToMessageId: params.replyTo?.messageId,
          replyToMessageCreatedAt: params.replyTo?.createdAt,
          onProgress: (ratio) => setUploadProgress(clientId, ratio),
        });
        return { clientId, serverId: parseCreatedMessageId(body) };
      }

      const { data, error } = await apiClient.POST(
        '/workspaces/{workspaceId}/conversations/{conversationId}/messages',
        {
          params: { path: { workspaceId, conversationId } },
          body: {
            text: params.text,
            clientId,
            flowId: params.flowId,
            nodeId: params.nodeId,
            replyToMessageId: params.replyTo?.messageId,
            replyToMessageCreatedAt: params.replyTo?.createdAt,
          },
        },
      );
      if (error) {
        throw new ApiError(error);
      }
      return { clientId, serverId: parseCreatedMessageId(data) };
    },

    onMutate: async (params) => {
      const { clientId } = params;
      await queryClient.cancelQueries({ queryKey });

      // Flow sends produce N server-side messages (the flow's own steps), fanned out over
      // realtime — there is no single "the message that was sent" to preview optimistically, and
      // inserting one would just be a bubble that never reconciles with anything. The composer
      // shows a transient "Sending flow…" toast instead (see composer.tsx).
      if (params.flowId) {
        return { clientId, skippedOptimistic: true as const };
      }

      queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) => {
        if (!old) return old;
        const [firstPage, ...restPages] = old.pages;
        if (!firstPage) return old;

        const existingIndex = firstPage.data.findIndex(
          (message) => 'clientId' in message && message.clientId === clientId,
        );
        // `__optimisticStatus` is deliberately off-schema — see optimistic-message.ts for the
        // narrowing contract. The base object itself is fully type-checked by the factory.
        const optimisticEntry = {
          ...createOptimisticMessage({
            clientId,
            conversationId,
            workspaceId,
            text: params.text,
            attachments: params.attachments,
            parentId: params.replyTo?.messageId ?? null,
          }),
          __optimisticStatus: 'pending',
        } as Message;

        const newData =
          existingIndex >= 0
            ? firstPage.data.map((message, index) =>
                index === existingIndex ? optimisticEntry : message,
              )
            : [optimisticEntry, ...firstPage.data];

        return { ...old, pages: [{ ...firstPage, data: newData }, ...restPages] };
      });

      return { clientId, skippedOptimistic: false as const };
    },

    onError: (error, params, context) => {
      if (!context) return;
      clearUploadProgress(context.clientId);

      // context.skippedOptimistic (flow sends): nothing was inserted, so there's no cache entry
      // to touch — but a blocked/unauthorized rejection below still restores the draft.

      const body = error instanceof ApiError ? error.body : null;
      const isTerminal =
        body?.code === 'workspaceBlocked' ||
        body?.status === 402 ||
        body?.code === 'UNAUTHORIZED' ||
        body?.status === 401;

      if (isTerminal) {
        removeOptimisticMessage(queryClient, queryKey, context.clientId);
        if (params.text) {
          setDraft(conversationId, params.text);
        }
        return;
      }

      if (context.skippedOptimistic) return;

      queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((message) =>
              'clientId' in message && message.clientId === context.clientId
                ? ({
                    ...message,
                    __optimisticStatus: 'failed',
                    __optimisticError: error instanceof Error ? error.message : 'Failed to send',
                  } as unknown as Message)
                : message,
            ),
          })),
        };
      });
    },

    onSuccess: (_data, _params, context) => {
      if (context) clearUploadProgress(context.clientId);
      // The sender's own optimistic bubble is reconciled here by simply refetching — the newly
      // created message (with its real server id) will replace the optimistic entry once the list
      // refetches, since clientId is embedded on the real message too and message-bubble.tsx keys
      // by clientId when present. Realtime handlers handle the same reconciliation for OTHER
      // clients viewing this conversation; this path only needs to work for the sender themself.
      // Flow sends (no optimistic entry) rely on this same invalidation/refetch (or realtime) to
      // surface the flow's resulting messages.
      queryClient.invalidateQueries({ queryKey });

      // Recorded in the shared chat store (not local mutation state) so the chat screen's
      // force-scroll-to-own-send logic sees it regardless of which `useSendMessage(...)` instance
      // performed the send — the screen's own instance (retry only) and the composer's instance
      // are separate mutations. Skipped for flow sends: there's no single bubble to scroll to.
      if (context && !context.skippedOptimistic) {
        setJustSentClientId(conversationId, context.clientId);
      }
    },
  });

  // Normalizes `clientId` once, before React Query hands params to `onMutate` and `mutationFn`
  // independently — otherwise each side generates its own id and the optimistic bubble never
  // matches the sent request (duplicate bubble, orphaned upload-progress entry, retry-scroll never
  // fires). Callers that pass their own `clientId` (retry) are left untouched.
  return {
    ...mutation,
    mutate: (params: SendMessageParams, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...params, clientId: params.clientId ?? generateClientId() }, options),
    mutateAsync: (
      params: SendMessageParams,
      options?: Parameters<typeof mutation.mutateAsync>[1],
    ) =>
      mutation.mutateAsync({ ...params, clientId: params.clientId ?? generateClientId() }, options),
  };
}
