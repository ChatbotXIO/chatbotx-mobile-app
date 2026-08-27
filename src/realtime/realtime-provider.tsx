import { useQueryClient } from '@tanstack/react-query';
import { usePartySocket } from 'partysocket/react';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect } from 'react';

import { getAuthToken } from '@/api/auth-token';
import { env } from '@/config/env';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

import { invalidateWorkspaceQueries, useRealtimeAppState } from './app-state';
import { generateOneTimeToken } from './one-time-token';
import { parseRealtimeEvent } from './parse-event';
import { clearAllTypingTimers } from './typing-timers';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';
import { useRealtimeHandlers } from './use-realtime-handlers';

/**
 * Real implementation, replacing the Phase 0-4 passthrough stub. Connects to the `workspaces`
 * PartyKit party, room = workspaceId (mirrors ../aha.chat apps/builder/src/features/chat/chat-realtime.tsx
 * and apps/realtime/src/parties/workspaces.ts).
 *
 * `?domain=` is REQUIRED on every mobile connection: the realtime server verifies the one-time
 * token by resolving a tenant origin from either the WebSocket request's `Origin` header (browsers
 * send this automatically) or a `?domain=<https url>` query param — React Native's WebSocket
 * implementation sends no `Origin` header at all, so without `domain` the server has nothing to
 * verify the token against and rejects the connection (verified by reading
 * ../aha.chat apps/realtime/src/lib/auth.ts `resolveVerificationOrigin`). The value must be the
 * SAME origin that serves `/api/auth/one-time-token/verify` — i.e. `env.apiBaseUrl` — not the
 * realtime server's own host.
 */
function ConnectedRealtimeProvider({
  children,
  workspaceId,
}: PropsWithChildren<{ workspaceId: string }>) {
  const queryClient = useQueryClient();
  const handleEvent = useRealtimeHandlers(queryClient, workspaceId);
  const setStatus = useConnectionStore((state) => state.setStatus);
  const markOpened = useConnectionStore((state) => state.markOpened);

  const socket = usePartySocket({
    host: env.wsUrl,
    party: 'workspaces',
    room: workspaceId,
    query: async () => {
      const authToken = await getAuthToken();
      if (!authToken) {
        return {};
      }
      const oneTimeToken = await generateOneTimeToken(authToken);
      return { token: oneTimeToken, domain: env.apiBaseUrl };
    },
    onMessage(event) {
      const parsed = parseRealtimeEvent(event.data);
      if (!parsed) {
        if (__DEV__) {
          console.warn('[realtime] dropped malformed event payload', event.data);
        }
        return;
      }
      handleEvent(parsed);
    },
    onOpen() {
      // `hasEverOpened` is read BEFORE `markOpened` flips it, so this correctly distinguishes the
      // very first connect (no reconciliation needed — the initial query fetches are already
      // fresh) from a reconnect after a drop (where events may have been missed while
      // disconnected, so the active workspace's queries need to be reconciled against the server).
      if (useConnectionStore.getState().hasEverOpened) {
        invalidateWorkspaceQueries(queryClient, workspaceId);
      }
      markOpened();
    },
    onClose() {
      setStatus('closed');
    },
    onError() {
      setStatus('closed');
    },
  });

  // Reset to 'connecting' whenever this component (re)mounts (fresh workspace, per the `key` on
  // RealtimeProvider below) — usePartySocket starts connecting immediately, so this reflects that
  // without waiting on the first onOpen/onClose callback.
  useEffect(() => {
    resetConnectionStore();
    return () => {
      clearAllTypingTimers();
    };
    // Runs once per mount — workspaceId is this component's whole identity via the parent's
    // `key={workspaceId}`, so a dependency array is unnecessary; teardown clears timers for the
    // room this instance owned.
  }, []);

  const handleBackground = useCallback(() => {
    socket.close();
  }, [socket]);

  const handleForeground = useCallback(() => {
    socket.reconnect();
    invalidateWorkspaceQueries(queryClient, workspaceId);
  }, [socket, queryClient, workspaceId]);

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
    // `key={workspaceId}` forces a full remount on workspace switch, tearing down the old
    // PartySocket connection (and its usePartySocket internal state) rather than reusing the
    // component instance with a new `room` prop — cleaner than relying on the socket library to
    // detect and rejoin a different room on its own.
    <ConnectedRealtimeProvider key={workspaceId} workspaceId={workspaceId}>
      {children}
    </ConnectedRealtimeProvider>
  );
}
