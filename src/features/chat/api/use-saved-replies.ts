import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/** `GET /workspaces/{workspaceId}/saved-replies` — flat list, no cursor pagination (confirmed in
 * the generated schema: `{ data: { id, shortcut, text }[] }`), so a plain useQuery is enough. */
export function useSavedReplies(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.savedReplies.list(workspaceId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/saved-replies', {
        params: { path: { workspaceId } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}
