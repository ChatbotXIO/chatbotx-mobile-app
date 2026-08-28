import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { defaultLanguage, resolveLocale } from '@/i18n/locales';
import { defaultNamespace } from '@/i18n/namespace';
import { resources } from '@/i18n/resources';

export {
  defaultLanguage,
  isRTL,
  isSupportedLanguage,
  localeMeta,
  resolveLocale,
  supportedLanguages,
} from '@/i18n/locales';
export type { SupportedLanguage } from '@/i18n/locales';
export { defaultNamespace } from '@/i18n/namespace';

function resolveDeviceLanguage() {
  // `languageTag` is the full BCP-47 tag (e.g. `zh-Hant-TW`, `pt-PT`) — `languageCode` would only
  // give the primary subtag and lose the region info resolveLocale needs for zh/pt normalization.
  return resolveLocale(Localization.getLocales()[0]?.languageTag);
}

let initialized = false;

/**
 * Initializes i18next once. Safe to call multiple times (e.g. across fast-refresh reloads) —
 * only the first call performs setup. Uses the device-resolved language; the persisted user
 * preference (if different) is applied afterwards via `applyLanguage` in the app bootstrap gate,
 * since settings-store hydration is async and can't block this synchronous module-load init.
 */
export function initI18n(): typeof i18next {
  if (initialized) {
    return i18next;
  }

  // i18next's default export intentionally also carries `.use()`/`.init()` as instance methods —
  // this is the library's documented API shape, not an accidental default-vs-named mismatch.
  // eslint-disable-next-line import/no-named-as-default-member
  i18next.use(initReactI18next).init({
    resources,
    lng: resolveDeviceLanguage(),
    fallbackLng: defaultLanguage,
    defaultNS: defaultNamespace,
    interpolation: {
      escapeValue: false,
    },
    // React Native has no XSS/HTML-injection concerns from interpolation, and Suspense adds
    // complexity we don't need for static locale files loaded synchronously at startup.
    react: {
      useSuspense: false,
    },
  });

  initialized = true;
  return i18next;
}

export { i18next };
