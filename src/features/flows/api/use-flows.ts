import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `flows.list` (`GET /v1/flows`) is page-numbered (`page`/`perPage`/`pageCount`), capped at 50 per
 * page. The inbox only allows active, inbox-enabled flows; keep the client filter in
 * FlowPickerSheet as defense in depth for stale or malformed responses.
 */
type ListFlowsOperation = operations['flows.list'];
export type ListFlowsResponse = ListFlowsOperation['responses'][200]['content']['application/json'];
export type FlowListItem = ListFlowsResponse['data'][number];

export function useFlows(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.flows.list(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async (): Promise<FlowListItem[]> => {
      return fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/flows', {
          params: { query: { active: true, enableInInbox: true, page, perPage: MAX_PER_PAGE } },
        });
        if (error) throw new ApiError(error);
        return data;
      });
    },
  });
}
