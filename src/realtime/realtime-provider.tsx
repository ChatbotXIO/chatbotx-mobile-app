import { useQueryClient } from '@tanstack/react-query';
import { usePartySocket } from 'partysocket/react';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { getAuthToken } from '@/api/auth-token';
import { env } from '@/config/env';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

import { invalidateWorkspaceQueries, useRealtimeAppState } from './app-state';
import { generateOneTimeToken } from './one-time-token';
import { parseRealtimeEvent } from './parse-event';
import { clearAllTypingTimers } from './typing-timers';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';
import { clearPendingConversationInvalidates, useRealtimeHandlers } from './use-realtime-handlers';

/**
 * Connects to the `workspaces` PartyKit party, room = workspaceId (mirrors the web app's
 * realtime connection).
 *
 * `?domain=` is REQUIRED on every mobile connection: the realtime server verifies the one-time
 * token by resolving a tenant origin from either the WebSocket request's `Origin` header (browsers
 * send this automatically) or a `?domain=<https url>` query param — React Native's WebSocket
 * implementation sends no `Origin` header at all, so without `domain` the server has nothing to
 * verify the token against and rejects the connection. The value must be the
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

  // Resets the connection store synchronously during this component's FIRST render — not in a
  // post-mount effect. `usePartySocket` below starts connecting immediately on mount, so an
  // effect-based reset can run AFTER `onOpen` has already fired and flipped the store to 'open',
  // clobbering it back to 'connecting' and leaving the banner stuck. `useState`'s lazy initializer
  // is the React-compiler-safe way to run this exactly once per mounted instance — reading/writing
  // a ref's `.current` during render (the more obvious "one-shot" pattern) is disallowed under
  // `reactCompiler: true` (see app.config.ts), since the compiler may re-execute render bodies.
  // The parent's `key={workspaceId}` already guarantees a fresh instance per workspace.
  useState(() => {
    resetConnectionStore();
    return null;
  });

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

  // Runs once per mount — workspaceId is this component's whole identity via the parent's
  // `key={workspaceId}`, so a dependency array is unnecessary; teardown clears both the typing
  // timers and the debounced conversations-list invalidation timers this instance's realtime
  // handlers may have scheduled, so neither leaks past the connection they belong to.
  useEffect(() => {
    return () => {
      clearAllTypingTimers();
      clearPendingConversationInvalidates();
    };
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
