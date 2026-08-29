jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// src/config/env.ts and src/config/brand.ts read Expo config at MODULE LOAD and throw when
// `extra` is absent, so any test importing a module that transitively pulls in either (e.g.
// api/client.ts, theme/tokens.ts) fails to load without this. app.config.ts is not evaluated
// under Jest, so supply the `extra` block here.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'https://test.invalid',
        wsUrl: 'wss://test.invalid',
        brandId: 'chatbotx',
        brandScheme: 'chatbotxmobileapp',
        brandColor: '#3c6df0',
      },
    },
  },
}));

// expo-secure-store is a native module with no Jest preset mock; src/api/auth-token.ts (and
// anything transitively importing src/api/client.ts) throws at import time without this. An
// in-memory Map is enough for tests that don't specifically assert persistence behavior.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

// expo-image renders a native view manager with no Jest preset mock; any component that renders
// <Avatar> (which uses expo-image's <Image>) throws "requireNativeViewManager is not available"
// under Jest without this. A plain react-native <Image> stand-in is enough for component tests
// that don't assert on image-loading behavior specifically.
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot
  // reference out-of-scope imports; requiring inline is the standard Jest pattern.
  const { Image: RNImage } = require('react-native');
  return {
    __esModule: true,
    Image: RNImage,
  };
});

// expo-crypto is a native module with no Jest preset mock; stub it with Node's own `crypto` so
// src/lib/install-crypto-polyfill.ts can be exercised without a device/simulator.
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot
  // reference out-of-scope imports; requiring inline is the standard Jest pattern.
  const nodeCrypto = require('node:crypto');
  return {
    __esModule: true,
    randomUUID: () => nodeCrypto.randomUUID(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock-only; expo-crypto's
    // real generic signature is asserted separately by src/lib/install-crypto-polyfill.ts.
    getRandomValues: (typedArray: any) => nodeCrypto.webcrypto.getRandomValues(typedArray),
  };
});

// expo-image-picker and expo-document-picker are native modules with no Jest preset mock (unlike
// expo-file-system's class-based File API, which the preset does special-case) — any test
// importing src/features/chat/lib/pick-attachments.ts (composer.tsx, camera.tsx, or the module
// itself) throws "Cannot find native module 'ExponentImagePicker'"/"...'ExpoDocumentPicker'"
// without these. Bare jest.fn() stand-ins are enough; tests that need specific picker results
// override these with jest.mock(...).mockResolvedValueOnce(...) locally.
jest.mock('expo-image-picker', () => ({
  __esModule: true,
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(),
}));

// react-native-gesture-handler's ReanimatedSwipeable (used by SwipeableRow) composes internal
// Tap/Pan gestures whose callbacks are worklet-ized by Reanimated's babel plugin inconsistently
// under Jest's transform — some callbacks read as worklets, some don't — which trips RNGH's own
// `checkGestureCallbacksForWorklets` dev-mode check (react-native-gesture-handler/src/handlers/
// gestures/GestureDetector/utils.ts). It's a false positive against RNGH's own compiled
// ReanimatedSwipeable.js, not anything in our code, and the gestures work correctly at runtime.
// Filter only this exact message so real console.error calls still fail tests as expected.
const RNGH_WORKLET_MIXED_CALLBACKS_MESSAGE =
  "Some of the callbacks in the gesture are worklets and some are not. Either make sure that all calbacks are marked as 'worklet' if you wish to run them on the UI thread or use '.runOnJS(true)' modifier on the gesture explicitly to run all callbacks on the JS thread.";

const originalConsoleError = console.error.bind(console);
jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes(RNGH_WORKLET_MIXED_CALLBACKS_MESSAGE)) {
    return;
  }
  originalConsoleError(...args);
});
