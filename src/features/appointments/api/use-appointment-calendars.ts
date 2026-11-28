import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

type ListCalendarsResponse =
  operations['appointmentCalendars.list']['responses'][200]['content']['application/json'];
export type AppointmentCalendar = ListCalendarsResponse['data'][number];

/** `appointmentCalendars.list` (`GET /v1/appointment-calendars`) drained into one array. Inactive
 * calendars are kept so the picker can show them disabled. */
export function useAppointmentCalendars(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.appointmentCalendars.list(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: (): Promise<AppointmentCalendar[]> =>
      fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/appointment-calendars', {
          params: { query: { page, perPage: MAX_PER_PAGE } },
        });
        if (error) throw new ApiError(error);
        return data;
      }),
  });
}
