import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { addNetworkStateListener } from 'expo-network';
import { AppState } from 'react-native';

import { ApiError, normalizeApiError } from '@/api/errors';
import { clearAuthToken, getAuthToken } from '@/api/auth-token';
import { parseRetryAfterMs } from '@/api/retry-after';
import { isNetworkStateReachable } from '@/realtime/use-network-reachability';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Global error normalization: FORBIDDEN mustChangePassword and 401 route through the auth store so
 * the root layout's redirect guard reacts everywhere, not just on the request that triggered it.
 * Blocked-workspace errors (403 trialExpired/macLimitReached) are left for the calling screen (composer banner, etc.) to read via
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
 * outcome. 429 is the exception: the request is fine, the per-user rate-limit window is just
 * full, so one retry after the server's `Retry-After` usually succeeds. Everything else (network
 * blips, 5xx) is retried once. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    const status = error.body.status;
    if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }
  return failureCount < 1;
}

const DEFAULT_RETRY_DELAY_MS = 1_000;

/** Waits the server-requested `Retry-After` on a 429; otherwise a short fixed delay. */
function retryDelay(_failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.body.status === 429) {
    return parseRetryAfterMs(null, error.message) ?? DEFAULT_RETRY_DELAY_MS;
  }
  return DEFAULT_RETRY_DELAY_MS;
}

// React Query has no native notion of app focus or connectivity in React Native; wire both so
// paused queries resume when the network returns and stale data refetches on foreground.
onlineManager.setEventListener((setOnline) => {
  const subscription = addNetworkStateListener((state) =>
    setOnline(isNetworkStateReachable(state)),
  );
  return () => subscription.remove();
});
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) =>
    handleFocus(state === 'active'),
  );
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay,
      staleTime: 30_000,
    },
  },
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
});
