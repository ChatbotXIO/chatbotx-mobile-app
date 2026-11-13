import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { Workspace } from '@/features/workspaces/api/use-workspaces';
import { useAuthStore } from '@/stores/use-auth-store';

/**
 * Creates the signed-in user's first workspace (`POST /v1/me/workspaces/default`). The backend is
 * idempotent and resolves to `null` when the user already belongs to a workspace or a plan limit
 * blocks creation, so callers must handle a null result.
 */
export function useEnsureDefaultWorkspace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (): Promise<Workspace | null> => {
      const displayName = user?.name || user?.email || '';
      const { data, error } = await apiClient.POST('/v1/me/workspaces/default', {
        body: { name: t('workspaces.defaultName', { name: displayName }) },
      });
      if (error) {
        throw new ApiError(error);
      }
      return data.workspace;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces() }),
  });
}
