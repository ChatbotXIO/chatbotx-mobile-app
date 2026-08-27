/**
 * `install-crypto-polyfill.ts` runs its polyfill as a module-load side effect, so each case must
 * `jest.resetModules()` and re-`require()` it to get a fresh evaluation, and must control
 * `globalThis.crypto` itself rather than relying on the ambient jsdom/node environment.
 */
function setGlobalCrypto(value: unknown): void {
  Object.defineProperty(globalThis, 'crypto', {
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
  require('./install-crypto-polyfill');
}

describe('install-crypto-polyfill', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    jest.resetModules();
    setGlobalCrypto(originalCrypto);
  });

  test('installs a working crypto global when none exists', () => {
    // Arrange
    setGlobalCrypto(undefined);
    jest.resetModules();

    // Act
    loadPolyfill();

    // Assert
    expect(globalThis.crypto).toBeDefined();
    expect(typeof globalThis.crypto.randomUUID).toBe('function');
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
  });

  test('randomUUID returns an RFC4122 v4-shaped string', () => {
    // Arrange
    setGlobalCrypto(undefined);
    jest.resetModules();
    loadPolyfill();

    // Act
    const id = globalThis.crypto.randomUUID();

    // Assert
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('getRandomValues fills the provided typed array in place', () => {
    // Arrange
    setGlobalCrypto(undefined);
    jest.resetModules();
    loadPolyfill();
    const buffer = new Uint8Array(16);

    // Act
    const result = globalThis.crypto.getRandomValues(buffer);

    // Assert
    expect(result).toBe(buffer);
    expect(buffer.some((byte) => byte !== 0)).toBe(true);
  });

  test('does not overwrite an existing crypto global', () => {
    // Arrange
    const existingCrypto = { randomUUID: () => 'existing', getRandomValues: jest.fn() };
    setGlobalCrypto(existingCrypto);
    jest.resetModules();

    // Act
    loadPolyfill();

    // Assert
    expect(globalThis.crypto).toBe(existingCrypto);
  });
});
