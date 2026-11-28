import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

import { availabilityRange } from '../lib/group-slots';

/** Calendar detail (for `timezone`, which the availability response doesn't carry) plus bookable
 * slots for the next 90 days. */
export function useCalendarAvailability(
  workspaceId: string,
  calendarId: string | null,
  contactId: string,
) {
  const detail = useQuery({
    queryKey: queryKeys.ws.appointmentCalendars.detail(workspaceId, calendarId ?? ''),
    enabled: calendarId !== null,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/appointment-calendars/{id}', {
        params: { path: { id: calendarId ?? '' } },
      });
      if (error) throw new ApiError(error);
      return data;
    },
  });

  const timezone = detail.data?.timezone;
  const slots = useQuery({
    queryKey: queryKeys.ws.appointmentCalendars.availability(workspaceId, calendarId ?? '', {
      contactId,
    }),
    enabled: calendarId !== null && timezone !== undefined,
    // Slots go stale quickly (other bookings, calendar edits); always refetch on mount.
    staleTime: 0,
    queryFn: async () => {
      const { startDate, endDate } = availabilityRange(timezone ?? 'UTC');
      const { data, error } = await apiClient.GET('/v1/appointment-calendars/{id}/availability', {
        params: { path: { id: calendarId ?? '' }, query: { startDate, endDate, contactId } },
      });
      if (error) throw new ApiError(error);
      return data.slots;
    },
  });

  return { calendar: detail.data, detail, slots };
}
