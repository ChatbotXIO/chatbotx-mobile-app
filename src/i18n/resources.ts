// Metro requires static `require`/`import` paths to bundle JSON — this file exists solely to
// gather every locale's translation JSON into one typed resources record for i18next.init().
import ar from '@/i18n/locales/ar.json';
import da from '@/i18n/locales/da.json';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fi from '@/i18n/locales/fi.json';
import fr from '@/i18n/locales/fr.json';
import he from '@/i18n/locales/he.json';
import id from '@/i18n/locales/id.json';
import it from '@/i18n/locales/it.json';
import ja from '@/i18n/locales/ja.json';
import nl from '@/i18n/locales/nl.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import ptPT from '@/i18n/locales/pt-PT.json';
import ro from '@/i18n/locales/ro.json';
import sv from '@/i18n/locales/sv.json';
import tr from '@/i18n/locales/tr.json';
import vi from '@/i18n/locales/vi.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import zhTW from '@/i18n/locales/zh-TW.json';
import type { SupportedLanguage } from '@/i18n/locales';

export const resources: Record<SupportedLanguage, { translation: typeof en }> = {
  ar: { translation: ar },
  da: { translation: da },
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  fi: { translation: fi },
  fr: { translation: fr },
  he: { translation: he },
  id: { translation: id },
  it: { translation: it },
  ja: { translation: ja },
  nl: { translation: nl },
  'pt-BR': { translation: ptBR },
  'pt-PT': { translation: ptPT },
  ro: { translation: ro },
  sv: { translation: sv },
  tr: { translation: tr },
  vi: { translation: vi },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
};
