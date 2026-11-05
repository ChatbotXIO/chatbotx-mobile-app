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
      // `inactive` (Control Center, app switcher peek, incoming call banner) keeps the socket;
      // only a real `background` stops it, otherwise every pull-down would drop the connection.
      if (nextState === 'background' && previousState.current !== 'background') {
        onBackground();
      } else if (nextState === 'active' && previousState.current === 'background') {
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
