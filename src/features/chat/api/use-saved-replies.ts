import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';

/** `savedReplies.list` (`GET /v1/saved-replies`) — page-numbered, drained into one list. */
export function useSavedReplies(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.savedReplies.list(workspaceId),
    queryFn: () =>
      fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/saved-replies', {
          params: { query: { page, perPage: MAX_PER_PAGE } },
        });
        if (error) throw new ApiError(error);
        return data;
      }),
  });
}
