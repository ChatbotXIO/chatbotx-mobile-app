import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/**
 * `GET /workspaces/{workspaceId}/inbox-teams` (`inboxTeamsAPI.listInboxTeamsAuthenticatedAPI`) —
 * an enterprise-tier feature; not every workspace/plan has it — the members screen treats any
 * error here as "no teams" (hides the section) rather than showing a broken error state, since a
 * 403/404 from an unlicensed workspace is an expected outcome, not a real failure to surface to
 * the user.
 */
export function useTeamsList(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.teams.list(workspaceId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/inbox-teams', {
        params: { path: { workspaceId } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
    enabled: workspaceId.length > 0,
    retry: false, // an unlicensed workspace's 403 shouldn't retry — resolve to "hidden" quickly.
  });
}
