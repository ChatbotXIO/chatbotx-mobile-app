import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

/**
 * Using app.config.ts (instead of a static app.json) so we can read process.env at build/start
 * time and expose runtime-configurable values (like the API base URL) via `expo-constants`.
 *
 * Values consumed by the app at runtime must be read through `expo-constants`
 * (see src/config/env.ts, src/config/brand.ts) — process.env is only available here, in the
 * Expo config context.
 *
 * Brand-loading/validation logic lives inline here (not in a separate `config/` module) because
 * Expo's config loader only Babel-transpiles this one entry file — a `require()` from inside it
 * to another sibling `.ts` file fails with "Cannot find module" (no TS-stripping registered for
 * transitive requires). See app.config.test.ts, which imports these exports directly under Jest
 * (which *does* handle the full `.ts` require graph) to unit-test them.
 */

export interface BrandConfig {
  id: string;
  displayName: string;
  slug: string;
  scheme: string;
  ios: { bundleIdentifier: string };
  android: { package: string; adaptiveIconBackgroundColor: string };
  colors: { brand: string; splashBackground: string };
  eas: { projectId: string; owner?: string };
}

/** `APP_ENV` selects the environment suffix applied to bundle id / display name / update channel
 * — lets dev/preview/production builds coexist on one device and route to distinct EAS Update
 * channels. See docs/deploy.md. */
export type AppEnv = 'development' | 'preview' | 'production';

export const APP_ENV_CONFIG: Record<
  AppEnv,
  { idSuffix: string; nameSuffix: string; channel: string }
> = {
  development: { idSuffix: '.dev', nameSuffix: ' (Dev)', channel: 'development' },
  preview: { idSuffix: '.preview', nameSuffix: ' (Test)', channel: 'preview' },
  production: { idSuffix: '', nameSuffix: '', channel: 'production' },
};

export function readAppEnv(raw: string | undefined): AppEnv {
  const value = raw ?? 'development';
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }
  throw new Error(
    `Invalid APP_ENV "${value}" — expected "development", "preview", or "production".`,
  );
}

/** Hand-rolled validation (matching the src/config/env.ts pattern elsewhere in the repo) rather
 * than pulling in zod for one call site that only ever runs in the Node config-evaluation
 * context, never bundled into the app. */
export function validateBrand(raw: unknown, brandId: string): BrandConfig {
  const fail = (field: string): never => {
    throw new Error(`brands/${brandId}/brand.json is missing or has an invalid "${field}" field.`);
  };

  if (typeof raw !== 'object' || raw === null) fail('(root)');
  const b = raw as Record<string, unknown>;

  if (typeof b.id !== 'string' || !b.id) fail('id');
  if (typeof b.displayName !== 'string' || !b.displayName) fail('displayName');
  if (typeof b.slug !== 'string' || !b.slug) fail('slug');
  if (typeof b.scheme !== 'string' || !b.scheme) fail('scheme');

  const ios = b.ios as Record<string, unknown> | undefined;
  if (!ios || typeof ios.bundleIdentifier !== 'string' || !ios.bundleIdentifier) {
    fail('ios.bundleIdentifier');
  }

  const android = b.android as Record<string, unknown> | undefined;
  if (!android || typeof android.package !== 'string' || !android.package) {
    fail('android.package');
  }
  if (typeof android?.adaptiveIconBackgroundColor !== 'string') {
    fail('android.adaptiveIconBackgroundColor');
  }

  const colors = b.colors as Record<string, unknown> | undefined;
  if (!colors || typeof colors.brand !== 'string') fail('colors.brand');
  if (typeof colors?.splashBackground !== 'string') fail('colors.splashBackground');

  const eas = b.eas as Record<string, unknown> | undefined;
  if (!eas || typeof eas.projectId !== 'string') fail('eas.projectId');

  return {
    id: b.id as string,
    displayName: b.displayName as string,
    slug: b.slug as string,
    scheme: b.scheme as string,
    ios: { bundleIdentifier: ios!.bundleIdentifier as string },
    android: {
      package: android!.package as string,
      adaptiveIconBackgroundColor: android!.adaptiveIconBackgroundColor as string,
    },
    colors: {
      brand: colors!.brand as string,
      splashBackground: colors!.splashBackground as string,
    },
    eas: {
      projectId: eas!.projectId as string,
      owner: typeof eas!.owner === 'string' && eas!.owner ? (eas!.owner as string) : undefined,
    },
  };
}

/** Loads and validates `brands/<id>/brand.json` relative to the repo root. */
export function loadBrand(brandId: string, repoRoot: string): BrandConfig {
  const brandDir = join(repoRoot, 'brands', brandId);
  const brandJsonPath = join(brandDir, 'brand.json');

  if (!existsSync(brandJsonPath)) {
    throw new Error(
      `Unknown BRAND "${brandId}": no brands/${brandId}/brand.json found. ` +
        `Run "pnpm brand:new ${brandId}" to create it, or set BRAND to an existing brand folder.`,
    );
  }

  const raw: unknown = JSON.parse(readFileSync(brandJsonPath, 'utf8'));
  return validateBrand(raw, brandId);
}

const brandId = process.env.BRAND ?? 'chatbotx';
const brand = loadBrand(brandId, __dirname);
const appEnv = readAppEnv(process.env.APP_ENV);
const envConfig = APP_ENV_CONFIG[appEnv];
// Uses the BRAND folder name, not `brand.id` — the two commonly diverge for `_template` (folder
// `_template`, placeholder `id: "example"`) and must not be assumed identical.
const assetsDir = `./brands/${brandId}/assets`;

// Loud stdout log: `BRAND` must be correct wherever eas-cli evaluates this file locally (e.g. to
// resolve `extra.eas.projectId` before a build upload) — a silently-wrong brand would build straight
// into the wrong customer's EAS project. See plan risk notes in docs/deploy.md.
// eslint-disable-next-line no-console -- deliberate build-time diagnostic, not app runtime code
console.log(`[app.config] brand=${brand.id} appEnv=${appEnv}`);

const hasEasProject = brand.eas.projectId.length > 0;

const config: ExpoConfig = {
  name: `${brand.displayName}${envConfig.nameSuffix}`,
  slug: brand.slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: `${assetsDir}/icon.png`,
  scheme: brand.scheme,
  userInterfaceStyle: 'automatic',
  // New Architecture is mandatory (no opt-out) as of this SDK — no `newArchEnabled` property
  // exists in the config schema to set.
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: `${brand.ios.bundleIdentifier}${envConfig.idSuffix}`,
    // Only OS-provided TLS/Keychain + random UUIDs — no custom crypto, so export-compliance exempt.
    // Skips the App Store Connect "App Encryption Documentation" prompt on every upload.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: `${brand.android.package}${envConfig.idSuffix}`,
    adaptiveIcon: {
      backgroundColor: brand.android.adaptiveIconBackgroundColor,
      foregroundImage: `${assetsDir}/android-icon-foreground.png`,
      backgroundImage: `${assetsDir}/android-icon-background.png`,
      monochromeImage: `${assetsDir}/android-icon-monochrome.png`,
    },
    predictiveBackGestureEnabled: false,
    // Edge-to-edge display is mandatory (no opt-out) as of this SDK — no `edgeToEdgeEnabled` knob
    // exists in the Android config schema to set.
    // Required for Android FCM V1 push delivery — prerequisite: a Firebase project with this
    // package name registered, its google-services.json downloaded to the repo root (gitignored,
    // not committed). Conditional on the file actually existing locally: it's a per-developer/CI
    // secret (see docs/deploy.md for the EAS file-secret setup), and an unconditional reference here
    // fails every clean checkout's Android build/prebuild before that secret is provisioned.
    googleServicesFile: existsSync('./google-services.json') ? './google-services.json' : undefined,
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.colors.splashBackground,
        image: `${assetsDir}/splash-icon.png`,
        imageWidth: 76,
      },
    ],
    'expo-image',
    'expo-web-browser',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos to attach them to messages.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow $(PRODUCT_NAME) to access your camera to attach photos to messages.',
      },
    ],
    [
      'expo-localization',
      {
        // Native RTL layout for `ar`/`he`. Requires a new dev/production build to take effect —
        // Expo Go can't apply native Info.plist/strings.xml changes, so `extra.supportsRTL` below
        // mirrors this for the app's own Expo-Go-safe RTL bootstrap logic (see src/i18n/reconcile-rtl.ts).
        supportsRTL: true,
      },
    ],
    [
      'expo-notifications',
      {
        // No dedicated notification icon asset exists yet (Android requires a flat white
        // silhouette, distinct from the app icon) — falls back to Expo's generated default until
        // one is designed. `color` matches the splash-screen brand color.
        color: brand.colors.splashBackground,
      },
    ],
    'expo-updates',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  // EAS Update: OTA JS-bundle updates without an app-store resubmission. `runtimeVersion` gates
  // which updates a given build can receive — 'appVersion' policy means any build sharing the
  // same `version` above can receive the same update (no native code change assumed between
  // updates to the same version).
  runtimeVersion: { policy: 'appVersion' },
  // A brand with no EAS project yet (e.g. a fresh open-source fork, or `_template`) omits
  // `updates`/`extra.eas` entirely so `expo start`/Expo Go work with zero EAS setup. Run
  // `eas init` (writes the resulting projectId into brands/<id>/brand.json, not app.json) to
  // opt back in — see docs/deploy.md.
  ...(hasEasProject
    ? {
        updates: { url: `https://u.expo.dev/${brand.eas.projectId}` },
      }
    : {}),
  extra: {
    // Falls back to the backend's default local dev URL. Override via `API_BASE_URL` env var
    // (e.g. in `.env`, loaded by `expo start` through the standard EXPO_PUBLIC_ / dotenv support,
    // or exported in the shell before running Expo CLI commands).
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3123',
    // Realtime PartyKit server. Web reads this from tenant settings; for mobile dev we default to
    // the local partykit dev port until tenant-settings discovery is wired up.
    wsUrl: process.env.WS_URL ?? 'http://localhost:1999',
    // Mirrors the expo-localization plugin's supportsRTL above for Expo Go, which can't read the
    // native Info.plist/strings.xml values the plugin writes at build time.
    supportsRTL: true,
    brandId: brand.id,
    displayName: brand.displayName,
    brandScheme: brand.scheme,
    brandColor: brand.colors.brand,
    appEnv,
    updateChannel: envConfig.channel,
    ...(hasEasProject
      ? {
          // Written by `eas init` — required by `getExpoPushTokenAsync` in src/lib/notifications.ts.
          eas: { projectId: brand.eas.projectId },
        }
      : {}),
  },
  ...(brand.eas.owner ? { owner: brand.eas.owner } : {}),
};

export default config;
