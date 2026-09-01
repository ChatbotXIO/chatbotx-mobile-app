// eslint-disable-next-line @typescript-eslint/no-require-imports -- Flow source, no .d.ts exists
const RNMessageEvent = require('react-native/src/private/webapis/html/events/MessageEvent')
  .default as typeof MessageEvent;

/**
 * Installs a global `MessageEvent` backed by React Native's own private `MessageEvent` class.
 *
 * Why this exists: `partysocket` (used by src/realtime/realtime-provider.tsx) detects React
 * Native via `navigator.product === 'ReactNative'` and, on that path, its `cloneEventNode()`
 * helper does `new MessageEvent(e.type, e)` against the bare global identifier — see
 * node_modules/partysocket/dist/ws.js. React Native's own `WebSocket.js` imports `MessageEvent`
 * from its private webapis module rather than relying on a global, so Hermes never defines
 * `globalThis.MessageEvent` itself. The result: every incoming socket message throws
 * `ReferenceError: Property 'MessageEvent' doesn't exist` before partysocket can dispatch it.
 *
 * Imported for its side effect only — see the import in src/app/_layout.tsx, alongside
 * install-crypto-polyfill.
 */
function installMessageEventPolyfill(): void {
  if (typeof globalThis.MessageEvent !== 'undefined') {
    return;
  }

  Object.defineProperty(globalThis, 'MessageEvent', {
    value: RNMessageEvent,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

installMessageEventPolyfill();
