import { useMutation } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import {
  getCachedDeviceToken,
  registerDeviceToken,
  unregisterCachedDeviceToken,
  unregisterDeviceToken,
} from '@/api/device-tokens';
import { getPushTokenAsync } from '@/lib/notifications';

/** The OS withheld push permission (user choice or unsupported device) — not a retryable failure. */
export class PushPermissionError extends Error {
  readonly status: 'denied' | 'unsupported';

  constructor(status: 'denied' | 'unsupported') {
    super(`Push permission ${status}`);
    this.name = 'PushPermissionError';
    this.status = status;
  }
}

export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: async () => {
      const result = await getPushTokenAsync();
      if (result.status !== 'granted') {
        throw new PushPermissionError(result.status);
      }
      await registerDeviceToken(result.token);
      return result.token;
    },
  });
}

export function useUnregisterDeviceToken() {
  return useMutation({
    mutationFn: () => unregisterCachedDeviceToken({ bestEffort: false }),
  });
}

/**
 * Keeps the backend row in sync with this install's Expo push token while push is enabled:
 * on entry (the backend row is per-account, so after signing in as someone else nothing else
 * registers this install) and whenever the OS rotates the token. The stale token is unregistered
 * first so the backend never holds two tokens for one install.
 *
 * `workspaceId` stays in the effect dependencies on purpose so a workspace switch re-syncs.
 */
export function usePushTokenRotation(workspaceId: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    async function sync() {
      try {
        // Never prompt from a background sync.
        const result = await getPushTokenAsync({ requestPermission: false });
        if (cancelled || result.status !== 'granted') return;

        const cached = await getCachedDeviceToken();
        if (cancelled) return;
        if (cached && cached !== result.token) {
          await unregisterDeviceToken(cached).catch(() => {});
          if (cancelled) return;
        }
        await registerDeviceToken(result.token);
      } catch {
        // Best-effort; the Settings toggle remains the manual path.
      }
    }

    void sync();

    // The listener payload is the native APNs/FCM token, not the Expo token, so re-fetch instead.
    const subscription = Notifications.addPushTokenListener(() => {
      void sync();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled, workspaceId]);
}
