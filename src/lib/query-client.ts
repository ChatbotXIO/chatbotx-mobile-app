import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { normalizeApiError } from '@/api/errors';
import { clearAuthToken } from '@/api/auth-token';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Global error normalization: FORBIDDEN mustChangePassword and 401 route through the auth store so
 * the root layout's redirect guard reacts everywhere, not just on the request that triggered it.
 * 402 workspaceBlocked is left for the calling screen (composer banner, etc.) to read via
 * `normalizeApiError` on its own `error` — this handler only manages the auth-affecting codes.
 */
function handleGlobalError(error: unknown): void {
  const normalized = normalizeApiError(error);

  if (normalized.kind === 'mustChangePassword') {
    useAuthStore.getState().setMustChangePassword(true);
    return;
  }
  if (normalized.kind === 'unauthorized') {
    clearAuthToken().catch(() => {});
    useAuthStore.getState().setSignedOut();
    useWorkspaceStore.getState().setCurrentWorkspaceId(null);
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
});
