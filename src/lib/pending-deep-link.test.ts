// `capturePendingDeepLink` is guarded by a module-scope `captured` flag (only the FIRST call
// across the whole process does anything — see the module's own doc comment) — so each case here
// needs a genuinely fresh module instance to test capture in isolation. `jest.resetModules()` +
// `jest.doMock` + a scoped `require()` (not a top-level `import`) gives each case its own
// instance of both `pending-deep-link.ts` AND the `expo-linking` mock it imports — a plain
// `jest.mock` at the top of the file doesn't survive `resetModules()` for the freshly-required
// module's own import of `expo-linking`.
function freshCapture(url: string | undefined, path: string): string | null {
  jest.resetModules();
  jest.doMock('expo-linking', () => ({
    getLinkingURL: jest.fn().mockReturnValue(url),
    parse: jest.fn().mockReturnValue({ path }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate fresh re-require for module-state isolation
  const fresh: typeof import('@/lib/pending-deep-link') = require('@/lib/pending-deep-link');
  fresh.capturePendingDeepLink();
  return fresh.consumePendingDeepLink();
}

afterEach(() => {
  jest.dontMock('expo-linking');
});

describe('capturePendingDeepLink / consumePendingDeepLink', () => {
  it('resolves a bare conversations/:id path to the (app) conversation route', () => {
    const result = freshCapture('chatbotxmobileapp://conversations/12345', 'conversations/12345');
    expect(result).toBe('/(app)/conversations/12345');
  });

  it('resolves a path that already embeds the (app) group prefix', () => {
    const result = freshCapture(
      'https://example.com/(app)/conversations/12345',
      '(app)/conversations/12345',
    );
    expect(result).toBe('/(app)/conversations/12345');
  });

  it('resolves a bare contacts/:id path to the (app) contact route', () => {
    const result = freshCapture('chatbotxmobileapp://contacts/999', 'contacts/999');
    expect(result).toBe('/(app)/contacts/999');
  });

  it('does nothing for an unrecognized path', () => {
    const result = freshCapture('chatbotxmobileapp://settings', 'settings');
    expect(result).toBeNull();
  });

  it('does nothing when there is no launch URL at all', () => {
    const result = freshCapture(undefined, '');
    expect(result).toBeNull();
  });

  it('consuming clears the stashed path so a later call returns null', () => {
    jest.resetModules();
    jest.doMock('expo-linking', () => ({
      getLinkingURL: jest.fn().mockReturnValue('chatbotxmobileapp://conversations/1'),
      parse: jest.fn().mockReturnValue({ path: 'conversations/1' }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate fresh re-require for module-state isolation
    const fresh: typeof import('@/lib/pending-deep-link') = require('@/lib/pending-deep-link');
    fresh.capturePendingDeepLink();

    expect(fresh.consumePendingDeepLink()).toBe('/(app)/conversations/1');
    expect(fresh.consumePendingDeepLink()).toBeNull();
  });

  it('only captures once per module instance — a second call is a no-op', () => {
    jest.resetModules();
    jest.doMock('expo-linking', () => ({
      getLinkingURL: jest.fn().mockReturnValue('chatbotxmobileapp://conversations/1'),
      parse: jest.fn().mockReturnValue({ path: 'conversations/1' }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate fresh re-require for module-state isolation
    const fresh: typeof import('@/lib/pending-deep-link') = require('@/lib/pending-deep-link');
    fresh.capturePendingDeepLink();
    fresh.capturePendingDeepLink(); // second call: no-op, even though nothing else changed

    expect(fresh.consumePendingDeepLink()).toBe('/(app)/conversations/1');
  });
});
