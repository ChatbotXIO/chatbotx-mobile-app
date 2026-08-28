import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

export interface Workspace {
  id: string;
  name: string;
  logo: string | null;
  brandColor: string;
}

/** Lists workspaces the current user is a member of (`GET /users/me/workspaces`).
 * Global key — not workspace-scoped, since it lists across workspaces. */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces(),
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await apiClient.GET('/users/me/workspaces');
      if (error) {
        throw new ApiError(error);
      }
      return data.workspaces;
    },
  });
}
