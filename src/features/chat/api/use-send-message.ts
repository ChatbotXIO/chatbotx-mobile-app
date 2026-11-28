import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError, normalizeApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import {
  getMessageClientId,
  getOptimisticErrorKind,
  markOptimisticFailed,
} from '@/features/chat/components/optimistic-message';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { useSendStatusStore } from '@/features/chat/stores/use-send-status-store';
import { runInSendQueue } from '@/features/chat/lib/send-queue';
import { reconcileSentMessage } from '@/realtime/apply-message-events';
import { generateClientId } from './generate-client-id';
import type { Message, MessagesInfiniteData } from './use-messages-infinite';
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

/** Longest message text the public API accepts. */
export const MAX_MESSAGE_TEXT_LENGTH = 1000;

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
    keepOriginal: null,
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
 * couldn't resolve the handler's real return type). It carries the created message's server `id`
 * (but not `clientId`, which the server never stores), so we narrow defensively rather than
 * casting blindly. */
function parseCreatedMessageId(body: unknown): string | null {
  if (body && typeof body === 'object' && 'id' in body && typeof body.id === 'string') {
    return body.id;
  }
  return null;
}

/** How long a send may wait for the channel's answer (see use-send-status-store.ts) before the
 * bubble stops trusting realtime and shows whatever the server now holds. Covers a lost event (the
 * socket dropped mid-send, or a reconnect burst that refetched instead of replaying) without
 * leaving the bubble "sending" forever. The worker retries a failing send several times before it
 * answers, so this is deliberately generous. */
const DELIVERY_CONFIRM_TIMEOUT_MS = 60_000;

function expireDeliveryTracking(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  clientId: string,
): void {
  setTimeout(() => {
    const store = useSendStatusStore.getState();
    if (!(clientId in store.sends)) return;
    store.stopTracking(clientId);
    void queryClient.invalidateQueries({ queryKey });
  }, DELIVERY_CONFIRM_TIMEOUT_MS);
}

function removeOptimisticMessageFromData(
  old: MessagesInfiniteData | undefined,
  clientId: string,
): MessagesInfiniteData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: page.data.filter((message) => getMessageClientId(message) !== clientId),
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
  const startTracking = useSendStatusStore((state) => state.startTracking);
  const attachMessageId = useSendStatusStore((state) => state.attachMessageId);
  const stopTracking = useSendStatusStore((state) => state.stopTracking);

  const postMessage = async (params: SendMessageParams & { clientId: string }) => {
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

    const { data, error } = await apiClient.POST('/v1/conversations/{conversationId}/messages', {
      params: { path: { conversationId } },
      body: {
        text: params.text,
        clientId,
        flowId: params.flowId,
        nodeId: params.nodeId,
        replyToMessageId: params.replyTo?.messageId,
        replyToMessageCreatedAt: params.replyTo?.createdAt,
      },
    });
    if (error) {
      throw new ApiError(error);
    }
    return { clientId, serverId: parseCreatedMessageId(data) };
  };

  const mutation = useMutation({
    mutationFn: (params: SendMessageParams & { clientId: string }) =>
      runInSendQueue(conversationId, params.clientId, () => postMessage(params)),

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

      // Started before the request so a channel answer that beats the create response (the worker
      // can be that fast) still finds the send. Stays "sending" until that answer arrives.
      startTracking(clientId, conversationId);

      queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) => {
        if (!old) return old;
        if (old.pages.length === 0) return old;
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

        // A retried row may sit on any page (messageRemoved can fail a row anywhere): replace it
        // in place, otherwise prepend to the first page.
        const isRetry = old.pages.some((page) =>
          page.data.some((message) => getMessageClientId(message) === clientId),
        );
        if (isRetry) {
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((message) =>
                getMessageClientId(message) === clientId ? optimisticEntry : message,
              ),
            })),
          };
        }
        const [firstPage, ...restPages] = old.pages;
        return {
          ...old,
          pages: [{ ...firstPage!, data: [optimisticEntry, ...firstPage!.data] }, ...restPages],
        };
      });

      return { clientId, skippedOptimistic: false as const };
    },

    onError: (error, params, context) => {
      if (!context) return;
      clearUploadProgress(context.clientId);
      // The request never reached the channel; the optimistic row carries the failure from here.
      stopTracking(context.clientId);

      // context.skippedOptimistic (flow sends): nothing was inserted, so there's no cache entry
      // to touch — but a blocked/unauthorized rejection below still restores the draft.

      const normalized = normalizeApiError(error);
      const isTerminal =
        normalized.kind === 'workspaceBlocked' || normalized.kind === 'unauthorized';

      if (isTerminal) {
        removeOptimisticMessage(queryClient, queryKey, context.clientId);
        if (params.text) {
          setDraft(conversationId, params.text);
        }
        return;
      }

      if (normalized.kind === 'messagingWindowClosed') {
        // The server's window verdict changed under us: refetch so the composer locks now.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.ws.conversations.detail(workspaceId, conversationId),
        });
      }

      if (context.skippedOptimistic) return;

      queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((message) =>
              getMessageClientId(message) === context.clientId
                ? markOptimisticFailed(message, getOptimisticErrorKind(error))
                : message,
            ),
          })),
        };
      });
    },

    onSuccess: (data, _params, context) => {
      if (context) clearUploadProgress(context.clientId);
      if (context && !context.skippedOptimistic) {
        if (data.serverId) {
          attachMessageId(context.clientId, data.serverId);
          // The server never stores clientId, so a refetch can't match its row to the optimistic
          // one. Give the local row its server id now (merging into the server row if a refetch or
          // `messageCreated` already landed it); keepLocalRows then matches by id.
          const serverId = data.serverId;
          queryClient.setQueryData<MessagesInfiniteData>(queryKey, (old) =>
            reconcileSentMessage(old, context.clientId, serverId),
          );
        }
        expireDeliveryTracking(queryClient, queryKey, context.clientId);
      }
      // Refetch to pick up anything else the send produced. Flow sends (no optimistic entry) rely
      // on this (or realtime) to surface the flow's resulting messages.
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
