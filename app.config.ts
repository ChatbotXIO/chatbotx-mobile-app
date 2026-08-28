import { existsSync } from 'node:fs';

import type { ExpoConfig } from 'expo/config';

/**
 * Using app.config.ts (instead of a static app.json) so we can read process.env at build/start
 * time and expose runtime-configurable values (like the API base URL) via `expo-constants`.
 *
 * Values consumed by the app at runtime must be read through `expo-constants`
 * (see src/config/env.ts) — process.env is only available here, in the Expo config context.
 */
const config: ExpoConfig = {
  name: 'ChatbotX',
  slug: 'chatbotx-mobile-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'chatbotxmobileapp',
  userInterfaceStyle: 'automatic',
  // New Architecture is mandatory (no opt-out) as of this SDK — no `newArchEnabled` property
  // exists in the config schema to set.
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.chatconnectx.mobile',
  },
  android: {
    package: 'com.chatconnectx.mobile',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Edge-to-edge display is mandatory (no opt-out) as of this SDK — no `edgeToEdgeEnabled` knob
    // exists in the Android config schema to set.
    // Required for Android FCM V1 push delivery — prerequisite: a Firebase project with this
    // package name registered, its google-services.json downloaded to the repo root (gitignored,
    // not committed). Conditional on the file actually existing locally: it's a per-developer/CI
    // secret (see README for the EAS file-secret setup), and an unconditional reference here fails
    // every clean checkout's Android build/prebuild before that secret is provisioned.
    googleServicesFile: existsSync('./google-services.json') ? './google-services.json' : undefined,
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
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
        color: '#208AEF',
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
  updates: {
    url: 'https://u.expo.dev/8cfd58a8-15f8-4f64-b16c-abf26166e80f',
  },
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
    // Written by `eas init` — required by `getExpoPushTokenAsync` in src/lib/notifications.ts.
    eas: {
      projectId: '8cfd58a8-15f8-4f64-b16c-abf26166e80f',
    },
  },
};

export default config;
