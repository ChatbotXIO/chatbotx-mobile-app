import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Client } from 'openapi-fetch';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { paths } from '@/api/generated/schema';
import { queryKeys } from '@/api/query-keys';

/** `POST /v1/conversations/{conversationId}/messages/{messageId}/resend` exists on the backend but
 * is missing from the committed `schema.ts`. The request body (`createdAt`, like the sibling
 * edit/delete message routes) is assumed, not read from a spec — verify it when the schema is
 * regenerated (`pnpm generate:api`), then delete this declaration and call `apiClient` directly. */
type ResendPaths = {
  '/v1/conversations/{conversationId}/messages/{messageId}/resend': {
    parameters: {
      query?: never;
      header?: never;
      path: { conversationId: string; messageId: string };
      cookie?: never;
    };
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: { conversationId: string; messageId: string };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': { createdAt: string } } };
      responses: {
        200: { headers: Record<string, unknown>; content: { 'application/json': unknown } };
      };
    };
  };
};

const resendClient = apiClient as unknown as Client<paths & ResendPaths>;

/** Re-queues a message the channel rejected (a server row carrying `sendError`). The row is
 * refetched afterwards so the error flag clears or updates. */
export function useResendMessage(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: string; createdAt: string }) => {
      const { error } = await resendClient.POST(
        '/v1/conversations/{conversationId}/messages/{messageId}/resend',
        {
          params: { path: { conversationId, messageId: params.messageId } },
          body: { createdAt: params.createdAt },
        },
      );
      if (error) throw new ApiError(error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ws.messages.list(workspaceId, conversationId),
      });
    },
  });
}
