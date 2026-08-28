import * as SecureStore from 'expo-secure-store';

/**
 * Auth token storage, backed by expo-secure-store (Keychain on iOS, Keystore-backed
 * EncryptedSharedPreferences on Android).
 *
 * This module only handles *storage* of a bearer token. The actual auth flow (sign-in, token
 * exchange, refresh) is a later phase, once the backend's bearer-auth endpoints are live.
 * `getAuthToken` currently always resolves to whatever was last persisted (or null), with no
 * refresh logic.
 */
const AUTH_TOKEN_KEY = 'chatbotx.authToken';

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
