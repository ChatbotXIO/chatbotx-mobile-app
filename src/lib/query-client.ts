import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, normalizeApiError } from '@/api/errors';
import { clearAuthToken, getAuthToken } from '@/api/auth-token';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Global error normalization: FORBIDDEN mustChangePassword and 401 route through the auth store so
 * the root layout's redirect guard reacts everywhere, not just on the request that triggered it.
 * 402 workspaceBlocked is left for the calling screen (composer banner, etc.) to read via
 * `normalizeApiError` on its own `error` — this handler only manages the auth-affecting codes.
 */
async function handleGlobalError(error: unknown): Promise<void> {
  const normalized = normalizeApiError(error);

  if (normalized.kind === 'mustChangePassword') {
    useAuthStore.getState().setMustChangePassword(true);
    return;
  }
  if (normalized.kind === 'unauthorized') {
    // A 401 fired before auth bootstrap resolved (or from a request that never carried a token in
    // the first place) doesn't mean the stored token is invalid — only force a sign-out when one
    // was actually present, otherwise this races the bootstrap and immediately re-signs-out a
    // user who was never actually rejected.
    const token = await getAuthToken();
    if (!token) return;

    clearAuthToken().catch(() => {});
    useAuthStore.getState().setSignedOut();
    useWorkspaceStore.getState().setCurrentWorkspaceId(null);
  }
}

/** Skip retrying 4xx responses — they're the server telling us the request itself is wrong
 * (bad input, unauthorized, not found, blocked), and retrying identically can't change that
 * outcome. Only retry once for everything else (network blips, 5xx). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    const status = error.body.status;
    if (status !== undefined && status >= 400 && status < 500) {
      return false;
    }
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
    },
  },
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
});
