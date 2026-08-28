import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isWorkspaceQuery } from '@/api/query-keys';

interface UseRealtimeAppStateOptions {
  onBackground: () => void;
  onForeground: () => void;
}

/**
 * Wraps AppState so the realtime provider can close its socket on background (saves battery/data,
 * avoids a stale connection accumulating missed events indefinitely) and reconnect + refresh on
 * return to foreground. `onForeground` is expected to both reconnect the socket AND invalidate the
 * active workspace's queries (any events missed while backgrounded are caught by the resulting
 * refetch, since there's no event-replay/backfill mechanism on the wire protocol).
 */
export function useRealtimeAppState({ onBackground, onForeground }: UseRealtimeAppStateOptions) {
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = previousState.current.match(/inactive|background/);
      const isNowActive = nextState === 'active';
      const isNowBackground = nextState.match(/inactive|background/);

      if (isNowBackground && !previousState.current.match(/inactive|background/)) {
        onBackground();
      } else if (isNowActive && wasBackground) {
        onForeground();
      }

      previousState.current = nextState;
    });

    return () => subscription.remove();
  }, [onBackground, onForeground]);
}

/** Invalidates every cached query for the given workspace — used as the "refresh on foreground"
 * half of the app-state handling, so a reconnect always heals against whatever changed while
 * backgrounded. */
export function invalidateWorkspaceQueries(queryClient: QueryClient, workspaceId: string) {
  queryClient.invalidateQueries({
    predicate: (query) => isWorkspaceQuery(query.queryKey, workspaceId),
  });
}
