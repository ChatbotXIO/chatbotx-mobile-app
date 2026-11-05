import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `sequences.list` (`GET /v1/sequences`) is page-numbered (`page`/`perPage`/`pageCount`), capped at
 * 50 per page and drained into one array. Filters to `active: true` server-side so the picker only
 * ever shows sequences that can currently be enrolled into.
 */
type ListSequencesOperation = operations['sequences.list'];
export type ListSequencesResponse =
  ListSequencesOperation['responses'][200]['content']['application/json'];
export type SequenceListItem = ListSequencesResponse['data'][number];

export function useSequences(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.sequences.list(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async (): Promise<SequenceListItem[]> => {
      return fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/sequences', {
          params: { query: { page, perPage: MAX_PER_PAGE, active: true } },
        });
        if (error) throw new ApiError(error);
        return data;
      });
    },
  });
}
