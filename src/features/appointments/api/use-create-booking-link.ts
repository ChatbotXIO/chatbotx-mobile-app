import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

import {
  bookingLinkClient,
  type BookingLinkBody,
  type BookingLinkResult,
} from './booking-link-client';

type CreateBookingLinkInput = BookingLinkBody;

/** `send: true` posts the link into the conversation as a button template (and pauses the bot for
 * 24h server-side, so the conversation detail is refetched); `send: false` only returns the URL so
 * the agent can open it on the customer's behalf. */
export function useCreateBookingLink(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookingLinkInput): Promise<BookingLinkResult> => {
      const { data, error } = await bookingLinkClient.POST(
        '/v1/conversations/{id}/appointment-booking-link',
        { params: { path: { id: conversationId } }, body: input },
      );
      if (error || !data) throw new ApiError(error);
      return data;
    },
    onSuccess: (_result, input) => {
      if (!input.send) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ws.conversations.detail(workspaceId, conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ws.messages.list(workspaceId, conversationId),
      });
    },
  });
}
