import { useQueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

import { invalidateWorkspaceQueries, useRealtimeAppState } from './app-state';
import { RealtimeFatalError } from './protocol/realtime-socket';
import { createRealtimeConnection } from './realtime-connection';
import { clearAllTypingTimers } from './typing-timers';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';
import { clearPendingConversationInvalidates, useRealtimeHandlers } from './use-realtime-handlers';

/** Connects the selected workspace to the v2 realtime gateway. The backend mints a short-lived
 * connect token and returns the workspace-specific socket URL, so mobile no longer needs a
 * separately configured realtime host. */
function ConnectedRealtimeProvider({
  children,
  workspaceId,
}: PropsWithChildren<{ workspaceId: string }>) {
  const queryClient = useQueryClient();
  const handleEvent = useRealtimeHandlers(queryClient, workspaceId);
  const setStatus = useConnectionStore((state) => state.setStatus);
  const markOpened = useConnectionStore((state) => state.markOpened);

  // This component is keyed by workspaceId, so this initializer creates exactly one connection
  // per selected workspace. It also resets synchronously before the connection starts in the
  // mount effect, avoiding a stale "open" banner from the previous workspace.
  const [connection] = useState(() => {
    resetConnectionStore();
    return createRealtimeConnection({
      getUrl: async (lastSeq) => {
        const { data, error } = await apiClient.GET('/v1/realtime/connect-token');
        if (error) {
          const apiError = new ApiError(error);
          const status = apiError.body.status;
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw new RealtimeFatalError(apiError.message);
          }
          throw apiError;
        }

        const url = new URL(data.socketUrl);
        url.searchParams.set('token', data.token);
        if (lastSeq) url.searchParams.set('lastSeq', lastSeq);
        return url.toString();
      },
      onEvent: handleEvent,
      onStatus: setStatus,
      onOpen: () => {
        if (useConnectionStore.getState().hasEverOpened) {
          invalidateWorkspaceQueries(queryClient, workspaceId);
        }
        markOpened();
      },
      onResync: () => invalidateWorkspaceQueries(queryClient, workspaceId),
      onDiagnostic: (error) => {
        if (__DEV__) console.warn('[realtime] connection error', error);
      },
    });
  });

  useEffect(() => {
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

  const handleForeground = useCallback(() => {
    connection.resume();
    invalidateWorkspaceQueries(queryClient, workspaceId);
  }, [connection, queryClient, workspaceId]);

  useRealtimeAppState({ onBackground: handleBackground, onForeground: handleForeground });

  return children;
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
