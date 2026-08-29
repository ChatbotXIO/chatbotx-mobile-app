import Constants from 'expo-constants';

interface BrandExtraConfig {
  brandId: string;
  brandScheme: string;
  brandColor: string;
}

const REQUIRED_FIELDS: readonly (keyof BrandExtraConfig)[] = [
  'brandId',
  'brandScheme',
  'brandColor',
];

function readExtra(): BrandExtraConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Partial<BrandExtraConfig>;

  for (const field of REQUIRED_FIELDS) {
    if (!extra[field]) {
      throw new Error(
        `Missing "extra.${field}" in Expo config. Check app.config.ts and the BRAND env var.`,
      );
    }
  }

  return {
    brandId: extra.brandId!,
    brandScheme: extra.brandScheme!,
    brandColor: extra.brandColor!,
  };
}

/**
 * Brand identity the app reads at runtime, sourced from `brands/<BRAND>/brand.json` via
 * app.config.ts `extra`. Only what src/ actually consumes is exposed here — the display name is
 * available as `Constants.expoConfig.name`, and the environment/update channel are build-time
 * concerns owned by eas.json. See docs/white-label.md for how a new brand is created and built.
 */
export const brand: BrandExtraConfig = readExtra();
