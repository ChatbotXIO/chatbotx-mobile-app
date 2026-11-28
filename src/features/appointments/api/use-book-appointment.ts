import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

export interface BookAppointmentInput {
  calendarId: string;
  contactId: string;
  conversationId?: string | null;
  startAt: string;
  inviteeTimezone: string;
}

/** `appointments.book` (`POST /v1/appointments`). Without a `conversationId` the customer is not
 * notified. On any failure the availability is refetched, since the usual causes (slot taken,
 * availability changed, contact double-booked) all mean the slot list on screen is stale. */
export function useBookAppointment(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BookAppointmentInput) => {
      const { data, error } = await apiClient.POST('/v1/appointments', { body: input });
      if (error) throw new ApiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ws.appointments.all(workspaceId) });
    },
    onError: (_error, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ws.appointmentCalendars.availability(workspaceId, input.calendarId, {
          contactId: input.contactId,
        }),
      });
    },
  });
}
