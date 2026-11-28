import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/** `appointments.cancel` (`POST /v1/appointments/{id}/cancel`) — also runs the calendar's
 * cancellation flow and drops pending reminders server-side. There is no reschedule endpoint:
 * cancel, then book again. */
export function useCancelAppointment(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await apiClient.POST('/v1/appointments/{id}/cancel', {
        params: { path: { id: appointmentId } },
      });
      if (error) throw new ApiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ws.appointments.all(workspaceId) });
    },
  });
}
