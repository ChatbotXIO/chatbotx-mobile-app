import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

type ListAppointmentsResponse =
  operations['appointments.list']['responses'][200]['content']['application/json'];
export type AppointmentItem = ListAppointmentsResponse['data'][number];

export type AppointmentTab = 'next' | 'past';

/** `GET /v1/appointments` has no `contactId` filter yet, so the workspace list is drained and
 * narrowed to this contact client-side. Replace the body with a server-side filter once the
 * backend adds one (the cache key already carries `contactId`). */
export function useContactAppointments(
  workspaceId: string | null,
  contactId: string,
  tab: AppointmentTab,
) {
  return useQuery({
    queryKey: queryKeys.ws.appointments.list(workspaceId ?? '', { contactId, tab }),
    enabled: workspaceId !== null,
    queryFn: async (): Promise<AppointmentItem[]> => {
      const all = await fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/appointments', {
          params: { query: { page, perPage: MAX_PER_PAGE, tab } },
        });
        if (error) throw new ApiError(error);
        return data;
      });
      return all.filter((appointment) => appointment.contactId === contactId);
    },
  });
}
