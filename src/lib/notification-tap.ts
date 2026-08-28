import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Data payload the backend attaches to a push notification (see plan Workstream 4.2 — the worker
 * sends `{ workspaceId, conversationId, messageId }` alongside title/body). All optional because
 * this same handler also has to tolerate a malformed/older payload without throwing.
 */
interface NotificationTapData {
  workspaceId?: string;
  conversationId?: string;
  messageId?: string;
}

function navigateToNotification(data: NotificationTapData): void {
  if (!data.conversationId) return;

  if (data.workspaceId && data.workspaceId !== useWorkspaceStore.getState().currentWorkspaceId) {
    useWorkspaceStore.getState().setCurrentWorkspaceId(data.workspaceId);
  }

  router.push({
    pathname: '/(app)/conversations/[conversationId]',
    params: { conversationId: data.conversationId },
  });
}

/** Handles a notification tap once the user is authenticated. If auth is still pending (tapped
 * from a cold start before sign-in resolves), stashes nothing here — `pending-deep-link.ts`
 * already covers the cold-start-URL case; this covers the warm/background-tap case where
 * `useAuthStore` is already resolved by the time the tap arrives. */
function handleResponse(response: Notifications.NotificationResponse): void {
  if (useAuthStore.getState().status !== 'signed-in') return;
  navigateToNotification(response.notification.request.content.data as NotificationTapData);
}

/**
 * Wires notification-tap → in-app navigation for both cold start (app launched by tapping a
 * notification) and warm/background taps. Call once at root layout mount, after auth bootstrap
 * has had a chance to resolve for the cold-start case — `getLastNotificationResponseAsync`
 * result stays available until consumed, so a short delay here doesn't lose it.
 */
export function initNotificationTapHandling(): () => void {
  let cancelled = false;

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!cancelled && response) handleResponse(response);
    })
    .catch(() => {
      // Best-effort cold-start check — a failure here just means the cold-start tap (if any) is
      // missed; the warm/background listener below still covers every subsequent tap.
    });

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  return () => {
    cancelled = true;
    subscription.remove();
  };
}
