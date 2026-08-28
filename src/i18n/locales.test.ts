import { isRTL, isSupportedLanguage, resolveLocale } from '@/i18n/locales';

describe('resolveLocale', () => {
  it('returns en for undefined', () => {
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('passes through an exact supported tag', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('vi')).toBe('vi');
    expect(resolveLocale('pt-PT')).toBe('pt-PT');
  });

  it('normalizes bare pt to pt-BR', () => {
    expect(resolveLocale('pt')).toBe('pt-BR');
  });

  it('normalizes any pt-* region tag to pt-BR (pt-PT only passes through exactly)', () => {
    expect(resolveLocale('pt-MZ')).toBe('pt-BR');
  });

  it('normalizes zh-Hant-HK to zh-TW', () => {
    expect(resolveLocale('zh-Hant-HK')).toBe('zh-TW');
  });

  it('normalizes zh-TW-flavored tags to zh-TW', () => {
    expect(resolveLocale('zh-TW')).toBe('zh-TW');
    expect(resolveLocale('zh-HK')).toBe('zh-TW');
    expect(resolveLocale('zh-MO')).toBe('zh-TW');
  });

  it('normalizes zh-CN/zh-Hans to zh-CN', () => {
    expect(resolveLocale('zh-CN')).toBe('zh-CN');
    expect(resolveLocale('zh-Hans')).toBe('zh-CN');
  });

  it('normalizes bare zh to zh-CN', () => {
    expect(resolveLocale('zh')).toBe('zh-CN');
  });

  it('matches on primary subtag for a region variant not otherwise special-cased', () => {
    expect(resolveLocale('de-AT')).toBe('de');
  });

  it('falls back to en for an unsupported language', () => {
    expect(resolveLocale('xx-YY')).toBe('en');
  });

  it('falls back to en for an empty string', () => {
    expect(resolveLocale('')).toBe('en');
  });
});

describe('isSupportedLanguage', () => {
  it('returns true for supported tags', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('zh-TW')).toBe(true);
  });

  it('returns false for unsupported tags', () => {
    expect(isSupportedLanguage('xx')).toBe(false);
  });
});

describe('isRTL', () => {
  it('returns true for ar and he', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('he')).toBe(true);
  });

  it('returns false for ltr languages', () => {
    expect(isRTL('en')).toBe(false);
    expect(isRTL('vi')).toBe(false);
  });
});
