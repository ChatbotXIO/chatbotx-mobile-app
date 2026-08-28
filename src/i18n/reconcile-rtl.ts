import { Platform, I18nManager } from 'react-native';

import { reloadApp } from '@/i18n/apply-language';
import { isRTL, type SupportedLanguage } from '@/i18n/locales';

/**
 * Called once at app bootstrap (splash still up) to make the native `I18nManager` direction match
 * the persisted language's writing direction. Unlike `changeAppLanguage`'s user-initiated flow,
 * this reloads silently (no dialog) since nothing has rendered yet.
 *
 * Skipped on web (I18nManager.forceRTL has no effect there — CSS `dir` handles it) and in Expo Go
 * `__DEV__`, where `forceRTL` is known not to persist across the JS reload it triggers, which would
 * otherwise cause a reload loop; logs a warning there instead.
 */
export async function reconcileRTLOnLaunch(language: SupportedLanguage): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const targetIsRTL = isRTL(language);
  if (targetIsRTL === I18nManager.isRTL) {
    return;
  }

  if (__DEV__) {
    console.warn(
      '[i18n] RTL direction mismatch detected in dev — forceRTL may not persist in Expo Go. ' +
        'Use a development build to verify RTL layout.',
    );
    return;
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(targetIsRTL);

  await reloadApp({ silent: true });
}
