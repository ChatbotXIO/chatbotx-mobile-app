# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Crypto

Never import Node's `crypto` (`crypto` / `node:crypto`) in app code. React Native runs on
**Hermes**, which has no Node standard library — the import resolves fine at build/type-check
time and even under Jest, then crashes only on a real device. Do not add `crypto-browserify` or
similar Node-crypto shims either.

- Use `expo-crypto` directly, or the Web-Crypto-shaped `crypto` global installed by
  `src/lib/install-crypto-polyfill.ts` (imported for its side effect at the top of
  `src/app/_layout.tsx`).
- `expo-crypto` already covers random generation, SHA-2 digests, and AES-GCM — do not add
  `react-native-get-random-values`, `expo-standard-web-crypto`, or `react-native-quick-crypto`;
  they'd be redundant.
- The installed `crypto` global only provides `randomUUID` and `getRandomValues`.
  **`crypto.subtle` is not implemented** — anything needing it (real hashing/HMAC/JWT
  verification) must call `expo-crypto`'s `digest`/`digestStringAsync` directly instead.
- `src/features/chat/api/generate-client-id.ts` uses `Math.random` on purpose — the backend
  types `clientId` as a numeric string (`zodBigintAsString()`), so a UUID would fail server
  validation. Don't "upgrade" it to `crypto.randomUUID()`.
