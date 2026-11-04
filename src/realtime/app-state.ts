import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isWorkspaceQuery } from '@/api/query-keys';

interface UseRealtimeAppStateOptions {
  onBackground: () => void;
  onForeground: () => void;
}

/**
 * Wraps AppState so the realtime provider can close its socket on background (saves battery/data)
 * and resume it on foreground. `onForeground` also invalidates active-workspace queries as a
 * defense-in-depth reconciliation step alongside v2 cursor replay.
 */
export function useRealtimeAppState({ onBackground, onForeground }: UseRealtimeAppStateOptions) {
  const previousState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = previousState.current?.match(/inactive|background/);
      const isNowActive = nextState === 'active';
      const isNowBackground = nextState.match(/inactive|background/);

      if (isNowBackground && !previousState.current?.match(/inactive|background/)) {
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
