import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  exchangeSocialCode,
  SOCIAL_CALLBACK_URL,
  startSocialSignIn,
  type SessionUser,
} from '@/api/auth-endpoints';
import { BrandIcon, GoogleLogo } from '@/components/ui/brand-icons';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { consumePendingDeepLink } from '@/lib/pending-deep-link';
import { useAuthStore } from '@/stores/use-auth-store';

import { AppleSignInButton } from './apple-sign-in-button';

type Provider = 'google' | 'facebook' | 'apple';

/**
 * Social sign-in uses the browser only for the provider interaction. The
 * backend redirects back with a 60-second single-use code, which the app
 * exchanges for the same mobile credential pair as password sign-in.
 */
export function SocialButtons() {
  const { t } = useTranslation();
  const setSignedIn = useAuthStore((state) => state.setSignedIn);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const completeSignIn = (user: SessionUser) => {
    setSignedIn(user);
    const pendingDeepLink = user.mustChangePassword ? null : consumePendingDeepLink();
    // A captured deep link is an arbitrary runtime string, not a route this app's typed-routes
    // manifest can know statically — `Href` (rather than `as never`) is expo-router's own type
    // for exactly this "any valid path string" case.
    router.replace((pendingDeepLink ?? '/') as Href);
  };

  const handleSignIn = async (provider: 'google' | 'facebook') => {
    setError(null);
    setLoadingProvider(provider);
    try {
      const start = await startSocialSignIn(provider);
      const result = await WebBrowser.openAuthSessionAsync(start.url, SOCIAL_CALLBACK_URL);

      if (result.type !== 'success') {
        // 'cancel' / 'dismiss' — user backed out, not an error.
        return;
      }

      const params = new URL(result.url).searchParams;
      const code = params.get('code');
      // A missing/mismatched `state` means this redirect isn't the response to the flow we started.
      if (!code || params.get('state') !== start.state) {
        setError(t('auth.socialSignInFailed'));
        return;
      }

      completeSignIn(await exchangeSocialCode(code, start.codeVerifier));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}
      {/* Apple first: guideline 4.8 wants it at least as prominent as the other providers. */}
      <AppleSignInButton
        disabled={loadingProvider !== null}
        onBusyChange={(busy) => setLoadingProvider(busy ? 'apple' : null)}
        onSignedIn={completeSignIn}
        onError={setError}
      />
      <Button
        label={t('auth.continueWithGoogle')}
        variant="secondary"
        size="lg"
        fullWidth
        leading={<GoogleLogo size={20} />}
        loading={loadingProvider === 'google'}
        disabled={loadingProvider !== null}
        onPress={() => handleSignIn('google')}
      />
      <Button
        label={t('auth.continueWithFacebook')}
        variant="secondary"
        size="lg"
        fullWidth
        leading={<BrandIcon name="facebook" size={20} color="#1877F2" />}
        loading={loadingProvider === 'facebook'}
        disabled={loadingProvider !== null}
        onPress={() => handleSignIn('facebook')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
});
