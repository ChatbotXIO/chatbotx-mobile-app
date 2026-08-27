import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { resolveLocale } from '@/i18n/locales';
import type { SupportedLanguage } from '@/i18n/locales';

export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsStoreState {
  themePreference: ThemePreference;
  language: SupportedLanguage;
  /** Persisted user *intent* for push notifications — not the effective permission state, which
   * can be revoked in OS Settings independently of this flag. See settings screen for how the two
   * combine. */
  pushEnabled: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setPushEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      language: resolveLocale(Localization.getLocales()[0]?.languageTag),
      pushEnabled: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      // Pure setter — i18next/dayjs/RTL side effects live in `changeAppLanguage`
      // (src/i18n/apply-language.ts), which calls this and then applies them.
      setLanguage: (language) => set({ language }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Resolves once the persisted settings-store snapshot has been read from AsyncStorage (or
 * immediately, if hydration already finished before this was called). */
export function waitForSettingsHydration(): Promise<void> {
  if (useSettingsStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
