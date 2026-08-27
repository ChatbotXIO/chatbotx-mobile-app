export const supportedLanguages = [
  'ar',
  'da',
  'de',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'id',
  'it',
  'ja',
  'nl',
  'pt-BR',
  'pt-PT',
  'ro',
  'sv',
  'tr',
  'vi',
  'zh-CN',
  'zh-TW',
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];
export const defaultLanguage: SupportedLanguage = 'en';

export const localeMeta: Record<SupportedLanguage, { nativeLabel: string; dir: 'ltr' | 'rtl' }> = {
  ar: { nativeLabel: 'العربية', dir: 'rtl' },
  da: { nativeLabel: 'Dansk', dir: 'ltr' },
  de: { nativeLabel: 'Deutsch', dir: 'ltr' },
  en: { nativeLabel: 'English', dir: 'ltr' },
  es: { nativeLabel: 'Español', dir: 'ltr' },
  fi: { nativeLabel: 'Suomi', dir: 'ltr' },
  fr: { nativeLabel: 'Français', dir: 'ltr' },
  he: { nativeLabel: 'עברית', dir: 'rtl' },
  id: { nativeLabel: 'Bahasa Indonesia', dir: 'ltr' },
  it: { nativeLabel: 'Italiano', dir: 'ltr' },
  ja: { nativeLabel: '日本語', dir: 'ltr' },
  nl: { nativeLabel: 'Nederlands', dir: 'ltr' },
  'pt-BR': { nativeLabel: 'Português (Brasil)', dir: 'ltr' },
  'pt-PT': { nativeLabel: 'Português (Portugal)', dir: 'ltr' },
  ro: { nativeLabel: 'Română', dir: 'ltr' },
  sv: { nativeLabel: 'Svenska', dir: 'ltr' },
  tr: { nativeLabel: 'Türkçe', dir: 'ltr' },
  vi: { nativeLabel: 'Tiếng Việt', dir: 'ltr' },
  'zh-CN': { nativeLabel: '简体中文', dir: 'ltr' },
  'zh-TW': { nativeLabel: '繁體中文', dir: 'ltr' },
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(value);
}

export function isRTL(language: SupportedLanguage): boolean {
  return localeMeta[language].dir === 'rtl';
}

function matchesLocaleTag(normalizedValue: string, localeTag: string) {
  return normalizedValue === localeTag || normalizedValue.startsWith(`${localeTag}-`);
}

/**
 * Verbatim port of the web app's resolveLocale (aha.chat apps/builder/src/i18n/config.ts) so
 * device-language resolution matches the web product exactly (pt/zh normalization, RTL locales).
 */
export function resolveLocale(value: string | undefined): SupportedLanguage {
  if (!value) {
    return defaultLanguage;
  }

  const normalizedValue = value.trim();
  if (isSupportedLanguage(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedLower = normalizedValue.toLowerCase();
  const language = normalizedLower.split('-')[0];
  if (!language) {
    return defaultLanguage;
  }
  if (language === 'pt') {
    return 'pt-BR';
  }
  if (
    ['zh-hant', 'zh-hk', 'zh-mo', 'zh-tw'].some((localeTag) =>
      matchesLocaleTag(normalizedLower, localeTag),
    )
  ) {
    return 'zh-TW';
  }
  if (['zh-cn', 'zh-hans'].some((localeTag) => matchesLocaleTag(normalizedLower, localeTag))) {
    return 'zh-CN';
  }
  if (language === 'zh') {
    return 'zh-CN';
  }

  return (
    supportedLanguages.find((locale) => locale.toLowerCase().split('-')[0] === language) ??
    defaultLanguage
  );
}
