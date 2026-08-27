import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `flowsAPI.privateListFlowsAPI` (`GET /workspaces/{workspaceId}/flows`) is the session-authenticated
 * flows list (the `WorkspaceTokenAPI` sibling requires a workspace token, not a bearer session).
 * Offset-paginated (`page`/`perPage`/`pageCount`), like contacts and members — NOT the cursor shape.
 * Flow lists are typically small, so this fetches a single large page rather than driving
 * useInfiniteQuery — revisit if a workspace has enough flows to need real pagination.
 */
type ListFlowsOperation = operations['flowsAPI.privateListFlowsAPI'];
export type ListFlowsResponse = ListFlowsOperation['responses'][200]['content']['application/json'];
export type FlowListItem = ListFlowsResponse['data'][number];

const PER_PAGE = 100;

export function useFlows(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.flows.list(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async (): Promise<FlowListItem[]> => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/flows', {
        params: { path: { workspaceId: workspaceId! }, query: { page: 1, perPage: PER_PAGE } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}
