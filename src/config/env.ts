import Constants from 'expo-constants';

interface AppExtraConfig {
  apiBaseUrl: string;
  wsUrl: string;
}

function readExtra(): AppExtraConfig {
  const extra = Constants.expoConfig?.extra as Partial<AppExtraConfig> | undefined;

  if (!extra?.apiBaseUrl) {
    throw new Error(
      'Missing "extra.apiBaseUrl" in Expo config. Check app.config.ts and the API_BASE_URL env var.',
    );
  }
  if (!extra?.wsUrl) {
    throw new Error(
      'Missing "extra.wsUrl" in Expo config. Check app.config.ts and the WS_URL env var.',
    );
  }

  return { apiBaseUrl: extra.apiBaseUrl, wsUrl: extra.wsUrl };
}

/**
 * Tenant-defining, env-driven app configuration. Sourced from app.config.ts `extra`, which in
 * turn reads `process.env.API_BASE_URL`/`WS_URL` at Expo config evaluation time.
 */
export const env: AppExtraConfig = readExtra();
