import { useQueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useWorkspaceStore } from '@/stores/use-workspace-store';

import { invalidateWorkspaceQueries, useRealtimeAppState } from './app-state';
import { mintRealtimeUrl } from './mint-realtime-url';
import { RealtimeControlsContext } from './realtime-context';
import { createRealtimeConnection } from './realtime-connection';
import { clearAllTypingTimers } from './typing-timers';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';
import { useNetworkReachability } from './use-network-reachability';
import { clearPendingConversationInvalidates, useRealtimeHandlers } from './use-realtime-handlers';

/** Connects the selected workspace to the v2 realtime gateway. The backend mints a short-lived
 * connect token and returns the workspace-specific socket URL, so mobile no longer needs a
 * separately configured realtime host. */
function ConnectedRealtimeProvider({
  children,
  workspaceId,
}: PropsWithChildren<{ workspaceId: string }>) {
  const queryClient = useQueryClient();
  const handleEvents = useRealtimeHandlers(queryClient, workspaceId);
  const setStatus = useConnectionStore((state) => state.setStatus);
  const markOpened = useConnectionStore((state) => state.markOpened);
  const markFailed = useConnectionStore((state) => state.markFailed);

  // This component is keyed by workspaceId, so this initializer creates exactly one connection
  // per selected workspace. It must stay free of store writes: updating the zustand store during
  // render would notify other mounted components (e.g. the connection title) mid-render.
  const [connection] = useState(() => {
    return createRealtimeConnection({
      getUrl: mintRealtimeUrl,
      onEvents: handleEvents,
      onStatus: setStatus,
      onOpen: ({ hasCursor }) => {
        // With a cursor the server replays missed frames (and closes with `resync`, which
        // refetches, if it cannot), so only a cursor-less reconnect needs a catch-up refetch.
        if (!hasCursor && useConnectionStore.getState().hasEverOpened) {
          invalidateWorkspaceQueries(queryClient, workspaceId);
        }
        markOpened();
      },
      onFailed: markFailed,
      onResync: () => invalidateWorkspaceQueries(queryClient, workspaceId),
      onDiagnostic: (error) => {
        if (__DEV__) console.warn('[realtime] connection error', error);
      },
    });
  });

  useEffect(() => {
    // Reset right before connecting so a stale "open" state from the previous workspace is
    // cleared; done in the effect (not render) to avoid setState-in-render warnings.
    resetConnectionStore();
    connection.start();
    return () => {
      connection.stop();
      clearAllTypingTimers();
      clearPendingConversationInvalidates();
    };
  }, [connection]);

  const handleBackground = useCallback(() => {
    connection.stop();
  }, [connection]);

  // The reconnect's `onOpen` owns the catch-up refetch, so foreground only resumes the socket.
  const handleForeground = useCallback(() => {
    connection.resume();
  }, [connection]);

  useRealtimeAppState({ onBackground: handleBackground, onForeground: handleForeground });

  const handleNetworkRegained = useCallback(() => {
    // A stopped (backgrounded) connection must not be revived by a network event.
    if (AppState.currentState === 'active') connection.resume();
  }, [connection]);

  useNetworkReachability({ onRegained: handleNetworkRegained });

  const controls = useMemo(() => ({ retry: () => connection.retry() }), [connection]);

  return (
    <RealtimeControlsContext.Provider value={controls}>{children}</RealtimeControlsContext.Provider>
  );
}

/** Only connects once a workspace is selected — defensive, since the tabs layout already guards
 * on `currentWorkspaceId` before mounting this provider, but a null id here should never attempt
 * a connection rather than crash on an empty room name. */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  if (!workspaceId) {
    return children;
  }

  return (
    // `key={workspaceId}` forces a full remount on workspace switch, stopping the previous
    // workspace connection and creating a fresh cursor for the newly selected workspace.
    <ConnectedRealtimeProvider key={workspaceId} workspaceId={workspaceId}>
      {children}
    </ConnectedRealtimeProvider>
  );
}
