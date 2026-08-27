import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { getPushTokenAsync } from '@/lib/notifications';

/**
 * Real Expo push token registration against `PUT/DELETE /users/me/device-tokens` (verified in
 * src/api/generated/schema.ts: PUT body `{ workspaceId?, platform: "ios"|"android", token }`,
 * DELETE body `{ token }`). The last-registered token is cached in SecureStore so unregister (and
 * re-registration after a token rotation) always targets the token the backend actually has on
 * file, not whatever `getExpoPushTokenAsync` returns *now* if it has since changed.
 */
const LAST_REGISTERED_TOKEN_KEY = 'chatbotx.lastRegisteredPushToken';

function resolvePlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null; // web / other — the backend enum has no matching value, don't attempt registration.
}

async function registerToken(workspaceId: string, token: string): Promise<void> {
  const platform = resolvePlatform();
  if (!platform) throw new Error('Push registration is only supported on iOS and Android.');

  const { error } = await apiClient.PUT('/users/me/device-tokens', {
    body: { workspaceId, platform, token },
  });
  if (error) throw new ApiError(error);
  await SecureStore.setItemAsync(LAST_REGISTERED_TOKEN_KEY, token);
}

async function unregisterToken(token: string): Promise<void> {
  const { error } = await apiClient.DELETE('/users/me/device-tokens', { body: { token } });
  if (error) throw new ApiError(error);
}

export function useRegisterDeviceToken(workspaceId: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await getPushTokenAsync();
      if (result.status !== 'granted') {
        throw new Error(`Push permission ${result.status}`);
      }
      await registerToken(workspaceId, result.token);
      return result.token;
    },
  });
}

export function useUnregisterDeviceToken() {
  return useMutation({
    mutationFn: async () => {
      const token = await SecureStore.getItemAsync(LAST_REGISTERED_TOKEN_KEY);
      if (!token) return;
      await unregisterToken(token);
      await SecureStore.deleteItemAsync(LAST_REGISTERED_TOKEN_KEY);
    },
  });
}

/**
 * Expo can issue a new push token at any time (token rotation) — this re-registers automatically
 * whenever that happens, but only while the user has push enabled (tracked by the caller via
 * `enabled`), and unregisters the stale token first so the backend never holds two tokens for one
 * install.
 */
export function usePushTokenRotation(workspaceId: string, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const subscription = Notifications.addPushTokenListener(async ({ data: newToken }) => {
      const previousToken = await SecureStore.getItemAsync(LAST_REGISTERED_TOKEN_KEY);
      if (previousToken && previousToken !== newToken) {
        await unregisterToken(previousToken).catch(() => {});
      }
      await registerToken(workspaceId, newToken);
      queryClient.invalidateQueries({ queryKey: ['device-token'] });
    });

    return () => subscription.remove();
  }, [enabled, workspaceId, queryClient]);
}
