import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getSession, SOCIAL_CALLBACK_URL, startSocialSignIn } from '@/api/auth-endpoints';
import { getAuthToken } from '@/api/auth-token';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { consumePendingDeepLink } from '@/lib/pending-deep-link';
import { useAuthStore } from '@/stores/use-auth-store';

type Provider = 'google' | 'facebook';

/**
 * Social sign-in buttons. Flow: `startSocialSignIn` gets the provider authorize URL from
 * better-auth, `WebBrowser.openAuthSessionAsync` opens it and resolves once the broker redirects
 * back to our brand's `<scheme>://auth-callback` (see auth-endpoints.ts for the
 * trustedOrigins gap that currently blocks this redirect server-side — this UI is correct but
 * won't complete end-to-end until that backend change lands).
 *
 * TOKEN HYDRATION — real, currently-unresolved gap: unlike email/password sign-in, which reads a
 * bearer token straight off the `set-auth-token` response header of a same-origin fetch, the OAuth
 * dance here happens inside `WebBrowser`'s own isolated browser session/cookie jar, not this app's
 * fetch client. Nothing in that flow currently hands this app a bearer token: the callback URL
 * `openAuthSessionAsync` resolves with is not parsed for one here (its shape/whether it carries a
 * token at all is unverified — parsing an assumed shape would be worse than not assuming), and the
 * `getSession()` call below only works if a token is ALREADY in SecureStore, which it isn't yet at
 * this point in the flow. So this currently cannot complete sign-in even once trustedOrigins is
 * fixed, UNLESS the backend's broker relay is changed to also forward a bearer token (e.g. as a
 * `token` query param on the `<scheme>://auth-callback` redirect, mirroring what
 * `set-auth-token` does for same-origin requests) — or a dedicated mobile token-exchange endpoint
 * is added. Neither is implemented here; both are backend-shaped decisions outside this repo.
 */
export function SocialButtons() {
  const { t } = useTranslation();
  const setSignedIn = useAuthStore((state) => state.setSignedIn);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleSignIn = async (provider: Provider) => {
    setError(null);
    setLoadingProvider(provider);
    try {
      const authorizeUrl = await startSocialSignIn(provider);
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, SOCIAL_CALLBACK_URL);

      if (result.type !== 'success') {
        // 'cancel' / 'dismiss' — user backed out, not an error.
        return;
      }

      // See the token-hydration note above: this only succeeds today if a token already exists in
      // SecureStore, which it won't for a fresh social sign-in. Left as the best-available
      // client-side step rather than a fabricated token-parsing shortcut.
      const token = await getAuthToken();
      const user = token ? await getSession(token) : null;
      if (!user) {
        setError(t('auth.socialSignInFailed'));
        return;
      }

      setSignedIn(user);
      const pendingDeepLink = user.mustChangePassword ? null : consumePendingDeepLink();
      // A captured deep link is an arbitrary runtime string, not a route this app's typed-routes
      // manifest can know statically — `Href` (rather than `as never`) is expo-router's own type
      // for exactly this "any valid path string" case.
      router.replace((pendingDeepLink ?? '/') as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}
      <Button
        label={t('auth.continueWithGoogle')}
        variant="secondary"
        loading={loadingProvider === 'google'}
        disabled={loadingProvider !== null}
        onPress={() => handleSignIn('google')}
      />
      <Button
        label={t('auth.continueWithFacebook')}
        variant="secondary"
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
