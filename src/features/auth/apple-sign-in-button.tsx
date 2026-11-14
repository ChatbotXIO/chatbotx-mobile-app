import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet } from 'react-native';

import {
  AuthApiError,
  createAppleNonce,
  signInWithAppleIdToken,
  type SessionUser,
} from '@/api/auth-endpoints';
import { isNetworkError } from '@/lib/describe-api-error';
import { describeAuthError } from '@/lib/describe-auth-error';
import { radiusTokens } from '@/theme/tokens';
import { useResolvedScheme } from '@/theme/use-theme';

const BUTTON_HEIGHT = 56;
const CANCELED_CODE = 'ERR_REQUEST_CANCELED';

interface AppleSignInButtonProps {
  /** True while any provider's sign-in is running, so a second one can't start. */
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSignedIn: (user: SessionUser) => void;
  /** Called with a message on failure, or `null` when a new attempt starts. */
  onError: (message: string | null) => void;
}

function isCanceled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === CANCELED_CODE
  );
}

/** Native Sign in with Apple (iOS only). Apple receives the SHA-256 of a nonce and the backend the
 * raw value, so a stolen identity token can't be replayed. */
export function AppleSignInButton({
  disabled,
  onBusyChange,
  onSignedIn,
  onError,
}: AppleSignInButtonProps) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let isActive = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (isActive) setIsAvailable(available);
      })
      .catch(() => {
        if (isActive) setIsAvailable(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  if (Platform.OS !== 'ios' || !isAvailable) return null;

  const handlePress = async () => {
    if (disabled) return;
    onError(null);
    onBusyChange(true);
    try {
      const nonce = await createAppleNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: nonce.hashed,
      });

      if (!credential.identityToken) {
        onError(t('auth.socialSignInFailed'));
        return;
      }

      const user = await signInWithAppleIdToken({
        idToken: credential.identityToken,
        nonce: nonce.raw,
        firstName: credential.fullName?.givenName,
        lastName: credential.fullName?.familyName,
      });
      onSignedIn(user);
    } catch (error) {
      // Backing out of the Apple sheet isn't an error.
      if (isCanceled(error)) return;
      if (__DEV__) console.warn('[apple-sign-in] failed', error);
      // The server's `message` is English-only; map by `code` to localized copy instead. Native
      // Apple/nonce failures keep the sign-in-specific copy rather than a generic "unknown".
      onError(
        error instanceof AuthApiError || isNetworkError(error)
          ? describeAuthError(error, t)
          : t('auth.socialSignInFailed'),
      );
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={radiusTokens.md}
      style={[styles.button, disabled && styles.disabled]}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    height: BUTTON_HEIGHT,
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});
