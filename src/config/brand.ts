import Constants from 'expo-constants';

type AppEnv = 'development' | 'preview' | 'production';

interface BrandExtraConfig {
  brandId: string;
  displayName: string;
  brandScheme: string;
  brandColor: string;
  appEnv: AppEnv;
  updateChannel: string;
}

function readExtra(): BrandExtraConfig {
  const extra = Constants.expoConfig?.extra as Partial<BrandExtraConfig> | undefined;

  if (!extra?.brandId) {
    throw new Error(
      'Missing "extra.brandId" in Expo config. Check app.config.ts and the BRAND env var.',
    );
  }
  if (!extra?.displayName) {
    throw new Error('Missing "extra.displayName" in Expo config. Check app.config.ts.');
  }
  if (!extra?.brandScheme) {
    throw new Error('Missing "extra.brandScheme" in Expo config. Check app.config.ts.');
  }
  if (!extra?.brandColor) {
    throw new Error('Missing "extra.brandColor" in Expo config. Check app.config.ts.');
  }
  if (!extra?.appEnv) {
    throw new Error(
      'Missing "extra.appEnv" in Expo config. Check app.config.ts and the APP_ENV env var.',
    );
  }
  if (!extra?.updateChannel) {
    throw new Error('Missing "extra.updateChannel" in Expo config. Check app.config.ts.');
  }

  return {
    brandId: extra.brandId,
    displayName: extra.displayName,
    brandScheme: extra.brandScheme,
    brandColor: extra.brandColor,
    appEnv: extra.appEnv,
    updateChannel: extra.updateChannel,
  };
}

/**
 * Brand identity, sourced from `brands/<BRAND>/brand.json` via app.config.ts `extra`. See
 * docs/white-label.md for how a new brand is created and built.
 */
export const brand: BrandExtraConfig = readExtra();
