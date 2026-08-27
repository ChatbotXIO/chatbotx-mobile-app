import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `sequencesAPI.listSequencesWorkspaceAuthAPI` (`GET /workspaces/{workspaceId}/sequences`) is the
 * session-authenticated sequences list (the `WorkspaceTokenAPI` sibling requires a workspace
 * token, not a bearer session). Offset-paginated (`page`/`perPage`/`pageCount`), like contacts and
 * flows — not the cursor shape. Filters to `active: true` server-side so the picker only ever
 * shows sequences that can currently be enrolled into.
 */
type ListSequencesOperation = operations['sequencesAPI.listSequencesWorkspaceAuthAPI'];
export type ListSequencesResponse =
  ListSequencesOperation['responses'][200]['content']['application/json'];
export type SequenceListItem = ListSequencesResponse['data'][number];

const PER_PAGE = 100;

export function useSequences(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.sequences.list(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async (): Promise<SequenceListItem[]> => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/sequences', {
        params: {
          path: { workspaceId: workspaceId! },
          query: { page: 1, perPage: PER_PAGE, active: true },
        },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}
