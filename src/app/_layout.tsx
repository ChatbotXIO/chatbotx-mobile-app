import '@/lib/install-crypto-polyfill';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getSession } from '@/api/auth-endpoints';
import { clearAuthToken, getAuthToken } from '@/api/auth-token';
import { ToastProvider } from '@/components/ui/toast';
import { initI18n } from '@/i18n';
import { applyLanguage } from '@/i18n/apply-language';
import { reconcileRTLOnLaunch } from '@/i18n/reconcile-rtl';
import { queryClient } from '@/lib/query-client';
import { capturePendingDeepLink } from '@/lib/pending-deep-link';
// Importing this (rather than only from Settings, lazily, as before) registers
// `Notifications.setNotificationHandler` unconditionally at app start — see notifications.ts.
import { ensureAndroidNotificationChannel } from '@/lib/notifications';
import { initNotificationTapHandling } from '@/lib/notification-tap';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSettingsStore, waitForSettingsHydration } from '@/stores/use-settings-store';
import { getNavigationTheme } from '@/theme/navigation-theme';
import { useResolvedScheme, useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

// i18next resources are static/local (bundled JSON, no network) and init() is synchronous, so
// this runs once at module load — before the first render — rather than as a render-triggered
// effect. That avoids the extra render pass a `useState` + `useEffect` combo would cause.
initI18n();
// Allows the OS/dev-build shell to lay out RTL before any native view mounts; actually flipping
// direction still requires `forceRTL` + a reload — see reconcile-rtl.ts.
I18nManager.allowRTL(true);
// Must run before the auth guard's first redirect can fire — see pending-deep-link.ts.
capturePendingDeepLink();

/**
 * Bootstrap gate: waits for the persisted settings store to hydrate, then applies the persisted
 * language to i18next/dayjs and reconciles native RTL direction against it — before the splash
 * screen can hide. Module-load `initI18n()` above already picked a device-resolved language
 * synchronously; this corrects it to the user's actual saved preference once hydration completes.
 */
function useLanguageBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await waitForSettingsHydration();
      const language = useSettingsStore.getState().language;
      await applyLanguage(language);
      await reconcileRTLOnLaunch(language);
    }

    bootstrap().finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

/**
 * Bootstrap gate: resolves the auth store's 'pending' status to 'signed-in'/'signed-out' by
 * checking for a stored token and validating it against `getSession`, then hides the splash
 * screen. Runs once at root-layout mount — every route's own guard reads `status` off the store
 * rather than re-checking the session itself.
 */
function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  const setSignedIn = useAuthStore((state) => state.setSignedIn);
  const setSignedOut = useAuthStore((state) => state.setSignedOut);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = await getAuthToken();
      if (!token) {
        if (!cancelled) setSignedOut();
        return;
      }

      const user = await getSession(token);
      if (cancelled) return;

      if (user) {
        setSignedIn(user);
      } else {
        await clearAuthToken();
        setSignedOut();
      }
    }

    bootstrap().finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once at mount; store setters are stable.
  }, []);

  return ready;
}

/**
 * Provider stack (outer → inner): gesture handler root (required once at the app root by
 * react-native-gesture-handler) > QueryClientProvider > BottomSheetModalProvider (so any screen
 * can open a modal bottom sheet without its own provider) > ThemeProvider (our tokens, adapted for
 * react-navigation via navigation-theme.ts). The auth bootstrap gate holds the splash screen until
 * session status resolves, before any route's own guard runs.
 */
export default function RootLayout() {
  const scheme = useResolvedScheme();
  const { colors } = useTheme();
  const authReady = useAuthBootstrap();
  const languageReady = useLanguageBootstrap();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (authReady && languageReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [authReady, languageReady, fontsLoaded]);

  // Registers the Android notification channel (idempotent — safe to call again even though
  // getPushTokenAsync also calls this lazily) and wires notification-tap → navigation, once auth
  // bootstrap has resolved. `initNotificationTapHandling` itself no-ops the tap navigation when
  // `useAuthStore` isn't 'signed-in' (see notification-tap.ts), so gating on `authReady` here is
  // about giving `getLastNotificationResponseAsync` a resolved auth state to check against for the
  // cold-start case, not a hard requirement for the listener registration itself.
  useEffect(() => {
    if (!authReady) return undefined;
    ensureAndroidNotificationChannel();
    return initNotificationTapHandling();
  }, [authReady]);

  // Android only — iOS has no themable window/root background to set here, and
  // `expo-system-ui` no-ops harmlessly on iOS/web.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <ThemeProvider value={getNavigationTheme(scheme)}>
            <ToastProvider>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen
                  name="image-viewer"
                  options={{
                    presentation: 'fullScreenModal',
                    animation: 'fade',
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
              </Stack>
            </ToastProvider>
          </ThemeProvider>
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
