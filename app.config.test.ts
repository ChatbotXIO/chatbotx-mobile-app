import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadBrand, readAppEnv, validateBrand } from './app.config';

const VALID_BRAND = {
  id: 'acme',
  displayName: 'Acme',
  slug: 'acme-app',
  scheme: 'acmeapp',
  ios: { bundleIdentifier: 'com.acme.app' },
  android: { package: 'com.acme.app', adaptiveIconBackgroundColor: '#ffffff' },
  colors: { brand: '#3c6df0', splashBackground: '#ffffff' },
  eas: { projectId: 'abc-123' },
};

describe('validateBrand', () => {
  test('returns a normalized BrandConfig for a fully valid brand.json', () => {
    const result = validateBrand(VALID_BRAND, 'acme');

    expect(result).toEqual({
      id: 'acme',
      displayName: 'Acme',
      slug: 'acme-app',
      scheme: 'acmeapp',
      ios: { bundleIdentifier: 'com.acme.app' },
      android: { package: 'com.acme.app', adaptiveIconBackgroundColor: '#ffffff' },
      colors: { brand: '#3c6df0', splashBackground: '#ffffff' },
      eas: { projectId: 'abc-123', owner: undefined },
    });
  });

  test('keeps a non-empty eas.owner', () => {
    const result = validateBrand(
      { ...VALID_BRAND, eas: { projectId: 'abc-123', owner: 'my-org' } },
      'acme',
    );
    expect(result.eas.owner).toBe('my-org');
  });

  test('treats an empty eas.owner as absent', () => {
    const result = validateBrand(
      { ...VALID_BRAND, eas: { projectId: 'abc-123', owner: '' } },
      'acme',
    );
    expect(result.eas.owner).toBeUndefined();
  });

  test('accepts uppercase hex colors', () => {
    const result = validateBrand(
      { ...VALID_BRAND, colors: { brand: '#136EF1', splashBackground: '#FFFFFF' } },
      'acme',
    );
    expect(result.colors.brand).toBe('#136EF1');
  });

  test('allows an empty eas.projectId (no EAS project configured yet)', () => {
    const result = validateBrand({ ...VALID_BRAND, eas: { projectId: '' } }, 'acme');
    expect(result.eas.projectId).toBe('');
  });

  test.each([
    ['id', { ...VALID_BRAND, id: '' }],
    ['displayName', { ...VALID_BRAND, displayName: undefined }],
    ['slug', { ...VALID_BRAND, slug: 123 }],
    ['scheme', { ...VALID_BRAND, scheme: '' }],
    ['ios.bundleIdentifier', { ...VALID_BRAND, ios: {} }],
    ['android.package', { ...VALID_BRAND, android: { adaptiveIconBackgroundColor: '#ffffff' } }],
    [
      'android.adaptiveIconBackgroundColor',
      { ...VALID_BRAND, android: { package: 'com.acme.app' } },
    ],
    ['colors.brand', { ...VALID_BRAND, colors: { splashBackground: '#ffffff' } }],
    ['colors.brand', { ...VALID_BRAND, colors: { ...VALID_BRAND.colors, brand: '#fff' } }],
    [
      'android.adaptiveIconBackgroundColor',
      { ...VALID_BRAND, android: { ...VALID_BRAND.android, adaptiveIconBackgroundColor: 'blue' } },
    ],
    ['colors.splashBackground', { ...VALID_BRAND, colors: { brand: '#ffffff' } }],
    ['eas.projectId', { ...VALID_BRAND, eas: {} }],
  ])('throws a message naming the missing field "%s"', (field, invalidBrand) => {
    expect(() => validateBrand(invalidBrand, 'acme')).toThrow(
      new RegExp(field.replace('.', '\\.')),
    );
  });

  test('throws for a non-object root', () => {
    expect(() => validateBrand(null, 'acme')).toThrow(/brands\/acme\/brand\.json/);
  });
});

describe('loadBrand', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'load-brand-test-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  test('reads and validates brands/<id>/brand.json', () => {
    const brandDir = join(repoRoot, 'brands', 'acme');
    mkdirSync(brandDir, { recursive: true });
    writeFileSync(join(brandDir, 'brand.json'), JSON.stringify(VALID_BRAND));

    const result = loadBrand('acme', repoRoot);
    expect(result.id).toBe('acme');
  });

  test('throws a clear error when the brand folder does not exist', () => {
    expect(() => loadBrand('missing-brand', repoRoot)).toThrow(
      /no brands\/missing-brand\/brand\.json found/,
    );
  });
});

describe('readAppEnv', () => {
  test('defaults to development when unset', () => {
    expect(readAppEnv(undefined)).toBe('development');
  });

  test.each(['development', 'preview', 'production'] as const)('accepts "%s"', (value) => {
    expect(readAppEnv(value)).toBe(value);
  });

  test('throws for an invalid value', () => {
    expect(() => readAppEnv('staging')).toThrow(/Invalid APP_ENV "staging"/);
  });
});
