import * as ExpoCrypto from 'expo-crypto';

/**
 * Installs a Web-Crypto-shaped `crypto` global backed by `expo-crypto`.
 *
 * Why this exists: neither Expo SDK 57's winter runtime (`expo/src/winter`, which installs
 * `fetch`/`FormData`/`TextDecoder`/`URL`/`AbortSignal`/`structuredClone`) nor React Native 0.86
 * core defines a global `crypto`. `partysocket` (used by src/realtime/realtime-provider.tsx)
 * reads it unconditionally in its `generateUUID()` helper:
 *
 *   if (crypto?.randomUUID) { return crypto.randomUUID(); }
 *
 * Optional chaining only guards a `null`/`undefined` *value* — it does not guard an undeclared
 * *binding*. On Hermes, the bare `crypto` identifier lookup throws
 * `ReferenceError: Property 'crypto' doesn't exist` before `?.` can short-circuit, so partysocket's
 * own `Math.random()` fallback is never reached. This module makes the global exist so that read
 * succeeds, and fixes the same gap for anything else that expects a standard `crypto`.
 *
 * Imported for its side effect only — see the first import in src/app/_layout.tsx.
 *
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
  // boundary rather than assigned directly, so callers still get the standard DOM signature; the
  // cast is safe because every concrete TypedArray callers pass (partysocket, any future caller)
  // satisfies expo-crypto's constraint at runtime.
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
