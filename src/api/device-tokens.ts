import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { brand } from '@/config/brand';

/**
 * Data access for the member-scoped `/v1/me/device-tokens` endpoint. The selected workspace is an
 * `x-workspace-id` header attached by apiClient's middleware, never a request-body field. The
 * last-registered token is cached in SecureStore so unregister (and re-registration after a token
 * rotation) always targets the token the backend actually has on file.
 */
export const LAST_REGISTERED_TOKEN_KEY = `${brand.brandId}.lastRegisteredPushToken`;

/** Upper bound for the best-effort unregister so a stalled network can't block sign-out. */
export const UNREGISTER_TIMEOUT_MS = 5_000;

function resolvePlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null; // web / other — the backend enum has no matching value, don't attempt registration.
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function getCachedDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_REGISTERED_TOKEN_KEY);
}

export async function clearCachedDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LAST_REGISTERED_TOKEN_KEY);
  } catch {
    // Best-effort cleanup.
  }
}

export async function registerDeviceToken(token: string): Promise<void> {
  const platform = resolvePlatform();
  if (!platform) throw new Error('Push registration is only supported on iOS and Android.');

  const { error } = await apiClient.PUT('/v1/me/device-tokens', { body: { platform, token } });
  if (error) throw new ApiError(error);
  await SecureStore.setItemAsync(LAST_REGISTERED_TOKEN_KEY, token);
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  const { error } = await apiClient.DELETE('/v1/me/device-tokens', { body: { token } });
  if (error) throw new ApiError(error);
}

/**
 * Unregisters the cached token from the signed-in account.
 * - Strict (default): throws on failure and keeps the cache so the caller can retry.
 * - `bestEffort`: for sign-out. Swallows failures, caps the request at `UNREGISTER_TIMEOUT_MS`
 *   and always clears the cache so the next account never inherits it.
 */
export async function unregisterCachedDeviceToken({
  bestEffort = false,
}: { bestEffort?: boolean } = {}): Promise<void> {
  const token = await getCachedDeviceToken();
  if (!token) return;

  if (!bestEffort) {
    await unregisterDeviceToken(token);
    await clearCachedDeviceToken();
    return;
  }

  try {
    await withTimeout(unregisterDeviceToken(token), UNREGISTER_TIMEOUT_MS);
  } catch {
    // Best-effort by design.
  } finally {
    await clearCachedDeviceToken();
  }
}
