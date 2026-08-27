import 'dayjs/locale/ar';
import 'dayjs/locale/da';
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/fi';
import 'dayjs/locale/fr';
import 'dayjs/locale/he';
import 'dayjs/locale/id';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/nl';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/pt';
import 'dayjs/locale/ro';
import 'dayjs/locale/sv';
import 'dayjs/locale/tr';
import 'dayjs/locale/vi';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import dayjs from 'dayjs';

import type { SupportedLanguage } from '@/i18n/locales';

/**
 * dayjs has no `pt-pt` locale — `pt` IS European Portuguese there, and Brazilian Portuguese is
 * the separate `pt-br` locale. This mapping must stay in sync with that dayjs convention.
 */
const dayjsLocaleNames: Record<SupportedLanguage, string> = {
  ar: 'ar',
  da: 'da',
  de: 'de',
  en: 'en',
  es: 'es',
  fi: 'fi',
  fr: 'fr',
  he: 'he',
  id: 'id',
  it: 'it',
  ja: 'ja',
  nl: 'nl',
  'pt-BR': 'pt-br',
  'pt-PT': 'pt',
  ro: 'ro',
  sv: 'sv',
  tr: 'tr',
  vi: 'vi',
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
};

export function setDayjsLocale(language: SupportedLanguage): void {
  dayjs.locale(dayjsLocaleNames[language]);
}
