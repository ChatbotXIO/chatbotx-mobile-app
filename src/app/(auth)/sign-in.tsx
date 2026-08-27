import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInput } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { signInWithEmail } from '@/api/auth-endpoints';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { SocialButtons } from '@/features/auth/social-buttons';
import { consumePendingDeepLink } from '@/lib/pending-deep-link';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/theme/use-theme';

const LOGO_SIZE = 72;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const setSignedIn = useAuthStore((state) => state.setSignedIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await signInWithEmail(email.trim(), password);
      setSignedIn(user);
      // If the app was cold-started via a `/conversations/:id` deep link (e.g. a push
      // notification, once delivery is wired up) while signed out, return there instead of the
      // default post-auth redirect — see lib/pending-deep-link.ts. A mustChangePassword user is
      // still routed to '/' regardless (its own guard traps them in change-password first).
      const pendingDeepLink = user.mustChangePassword ? null : consumePendingDeepLink();
      router.replace((pendingDeepLink ?? '/') as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.form, { gap: spacing.md }]}>
            <View style={[styles.logoWrap, { marginBottom: spacing.sm }]}>
              <View
                style={[
                  styles.logoCircle,
                  { backgroundColor: colors.brandSoft, borderRadius: LOGO_SIZE / 2 },
                ]}
              >
                <Icon name="chatbubbles" size={32} color={colors.brand} />
              </View>
            </View>

            <Text variant="display" style={styles.centered}>
              {t('auth.signIn')}
            </Text>
            <Text variant="body" color="secondary" style={styles.centered}>
              {t('auth.signInSubtitle')}
            </Text>

            {error ? <ErrorBanner message={error} /> : null}

            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            <TextField
              ref={passwordInputRef}
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              blurOnSubmit
              onSubmitEditing={handleSubmit}
              trailingIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              trailingIconAccessibilityLabel={
                isPasswordVisible ? t('auth.hidePassword') : t('auth.showPassword')
              }
              onTrailingIconPress={() => setIsPasswordVisible((visible) => !visible)}
            />

            <Button
              label={t('auth.signIn')}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              size="lg"
              fullWidth
            />

            <Link href="/(auth)/forgot-password" style={styles.link}>
              <Text variant="callout" color="brand">
                {t('auth.forgotPassword')}
              </Text>
            </Link>

            <Card style={[styles.divider, { padding: spacing.sm }]}>
              <Text variant="caption" color="secondary" style={styles.centered}>
                {t('auth.orContinueWith')}
              </Text>
            </Card>
            <SocialButtons />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    width: '100%',
  },
  logoWrap: {
    alignItems: 'center',
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    alignSelf: 'center',
  },
  divider: {
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
