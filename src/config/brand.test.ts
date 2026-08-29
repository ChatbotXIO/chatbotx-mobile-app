const VALID_EXTRA = {
  brandId: 'chatbotx',
  brandScheme: 'chatbotxmobileapp',
  brandColor: '#3c6df0',
};

function loadBrandWith(extra: Record<string, unknown> | undefined): () => typeof import('./brand') {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: extra === undefined ? undefined : { extra } },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module load per mock
  return () => require('./brand') as typeof import('./brand');
}

describe('brand', () => {
  afterEach(() => {
    jest.dontMock('expo-constants');
  });

  it('exposes the brand fields from Expo config extra', () => {
    const { brand } = loadBrandWith(VALID_EXTRA)();
    expect(brand).toEqual(VALID_EXTRA);
  });

  it.each(['brandId', 'brandScheme', 'brandColor'] as const)(
    'throws at load when "%s" is missing',
    (field) => {
      const { [field]: _omitted, ...rest } = VALID_EXTRA;
      expect(loadBrandWith(rest)).toThrow(new RegExp(`extra\\.${field}`));
    },
  );

  it('throws at load when expoConfig is absent entirely', () => {
    expect(loadBrandWith(undefined)).toThrow(/extra\.brandId/);
  });
});
