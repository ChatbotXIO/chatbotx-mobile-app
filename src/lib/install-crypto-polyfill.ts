import * as ExpoCrypto from 'expo-crypto';

/**
 * Installs a Web-Crypto-shaped `crypto` global backed by `expo-crypto`.
 *
 * Why this exists: neither Expo SDK 57's winter runtime (`expo/src/winter`, which installs
 * `fetch`/`FormData`/`TextDecoder`/`URL`/`AbortSignal`/`structuredClone`) nor React Native 0.86
 * core defines a global `crypto`. `src/api/auth-device.ts` uses `crypto.randomUUID()` to create a
 * persistent mobile device identifier, so this module makes that standard global available on
 * Hermes.
 *
 * Imported for its side effect only — see the first import in src/app/_layout.tsx.

 * This only shapes `randomUUID` and `getRandomValues` — `crypto.subtle` is deliberately not
 * implemented. Anything needing real hashing/HMAC (e.g. SHA-256) should call `expo-crypto`'s
 * `digest`/`digestStringAsync` directly rather than expecting it on this global. See AGENTS.md.
 */
function installCryptoPolyfill(): void {
  if (typeof globalThis.crypto !== 'undefined') {
    return;
  }

  // expo-crypto's `getRandomValues` is generic over int/uint TypedArrays specifically, narrower
  // than DOM's `Crypto.getRandomValues<T extends ArrayBufferView | null>`. Cast once at this
  // boundary rather than assigning directly so callers retain the standard DOM signature.
  const getRandomValues = ExpoCrypto.getRandomValues as unknown as Crypto['getRandomValues'];

  const cryptoPolyfill: Pick<Crypto, 'randomUUID' | 'getRandomValues'> = {
    randomUUID: () =>
      ExpoCrypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    getRandomValues,
  };

  // Plain assignment can silently no-op if the engine defines `crypto` as a non-writable
  // accessor rather than a normal data property; `defineProperty` guarantees the global sticks.
  Object.defineProperty(globalThis, 'crypto', {
    value: cryptoPolyfill,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

installCryptoPolyfill();
