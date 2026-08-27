import { Alert, DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

import { i18next } from '@/i18n';
import { setDayjsLocale } from '@/i18n/dayjs-locales';
import { isRTL, type SupportedLanguage } from '@/i18n/locales';
import { useSettingsStore } from '@/stores/use-settings-store';

/** Applies a language to the running app's i18next + dayjs instances. Does not persist it or
 * reconcile RTL — see `changeAppLanguage` for the full user-facing flow. */
export async function applyLanguage(language: SupportedLanguage): Promise<void> {
  await i18next.changeLanguage(language);
  setDayjsLocale(language);
}

/**
 * Reloads the app JS bundle. `Updates.reloadAsync` is a native-production API that throws in
 * `__DEV__`/Expo Go (no update runtime available there), so we use `DevSettings.reload()`
 * instead in those environments. `Updates.isEnabled` reflects whether the `expo-updates` native
 * module is actually linked into *this* build — it can be false in a production build if the
 * app was built before the `expo-updates` package/plugin were added (needs a fresh build to pick
 * up the native module), independent of whether EAS Update hosting is configured. In that case
 * there is no reload mechanism available at all; the RTL/language change still takes effect on
 * the *next* natural app relaunch, so we surface an alert rather than silently doing nothing.
 */
export async function reloadApp(): Promise<void> {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  if (!Updates.isEnabled) {
    Alert.alert(
      i18next.t('settings.restartRequiredTitle'),
      i18next.t('settings.restartManuallyMessage'),
    );
    return;
  }
  await Updates.reloadAsync();
}

/**
 * Full user-initiated language change: persist the choice, apply it live, and — if the new
 * language's writing direction differs from the current `I18nManager` direction — force the RTL
 * flag and prompt the user to restart (native layout direction cannot flip without a reload).
 */
export async function changeAppLanguage(language: SupportedLanguage): Promise<void> {
  useSettingsStore.getState().setLanguage(language);
  await applyLanguage(language);

  const targetIsRTL = isRTL(language);
  if (targetIsRTL === I18nManager.isRTL) {
    return;
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(targetIsRTL);

  Alert.alert(
    i18next.t('settings.restartRequiredTitle'),
    i18next.t('settings.restartRequiredMessage'),
    [
      { text: i18next.t('settings.restartLater'), style: 'cancel' },
      { text: i18next.t('settings.restartNow'), onPress: () => void reloadApp() },
    ],
  );
}
