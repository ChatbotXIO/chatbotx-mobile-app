import * as SecureStore from 'expo-secure-store';

import { brand } from '@/config/brand';

/**
 * Mobile credentials are persisted together so an access token can never be
 * accidentally retained after its refresh-token partner has been revoked.
 * SecureStore maps to Keychain/Keystore on native platforms.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const AUTH_TOKEN_KEY = `${brand.brandId}.authTokens`;

export async function getAuthTokens(): Promise<AuthTokens | null> {
  const serialized = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (!serialized) return null;

  try {
    const tokens = JSON.parse(serialized) as Partial<AuthTokens>;
    if (
      typeof tokens.accessToken !== 'string' ||
      typeof tokens.refreshToken !== 'string' ||
      typeof tokens.expiresAt !== 'number'
    ) {
      throw new Error('Invalid stored mobile credentials');
    }
    return tokens as AuthTokens;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    return null;
  }
}

/** Returns the persisted access token without refreshing it. */
export async function getAuthToken(): Promise<string | null> {
  return (await getAuthTokens())?.accessToken ?? null;
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  // The grant responses carry more fields (deviceId, mustChangePassword, …); persist only the
  // credential triple so stale extras can't be read back later.
  const { accessToken, refreshToken, expiresAt } = tokens;
  await SecureStore.setItemAsync(
    AUTH_TOKEN_KEY,
    JSON.stringify({ accessToken, refreshToken, expiresAt }),
  );
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
