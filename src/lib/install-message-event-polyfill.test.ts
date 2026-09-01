/**
 * `install-message-event-polyfill.ts` runs its polyfill as a module-load side effect, so each case
 * must `jest.resetModules()` and re-`require()` it to get a fresh evaluation, and must control
 * `globalThis.MessageEvent` itself rather than relying on the ambient jsdom/node environment.
 */
function setGlobalMessageEvent(value: unknown): void {
  Object.defineProperty(globalThis, 'MessageEvent', {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

/** Re-imports the polyfill fresh (after `jest.resetModules()`) so its side effect re-runs. */
function loadPolyfill(): void {
  // A static top-level import would only ever evaluate once; a dynamic require after
  // resetModules() is required to re-run the module's side effect for each case below.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./install-message-event-polyfill');
}

describe('install-message-event-polyfill', () => {
  const originalMessageEvent = globalThis.MessageEvent;

  afterEach(() => {
    jest.resetModules();
    setGlobalMessageEvent(originalMessageEvent);
  });

  test('installs a working MessageEvent global when none exists', () => {
    // Arrange
    setGlobalMessageEvent(undefined);
    jest.resetModules();

    // Act
    loadPolyfill();

    // Assert
    expect(globalThis.MessageEvent).toBeDefined();
    const event = new globalThis.MessageEvent('message', { data: 'hello' });
    expect(event.type).toBe('message');
    expect(event.data).toBe('hello');
  });

  test('does not overwrite an existing MessageEvent global', () => {
    // Arrange
    class ExistingMessageEvent {}
    setGlobalMessageEvent(ExistingMessageEvent);
    jest.resetModules();

    // Act
    loadPolyfill();

    // Assert
    expect(globalThis.MessageEvent).toBe(ExistingMessageEvent);
  });
});
