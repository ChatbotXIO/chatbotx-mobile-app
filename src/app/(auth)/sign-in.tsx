import Constants from 'expo-constants';
import { Link, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInputInstance } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeAuthError } from '@/lib/describe-auth-error';
import { signInWithEmail } from '@/api/auth-endpoints';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { ErrorBanner } from '@/components/ui/error-banner';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { SocialButtons } from '@/features/auth/social-buttons';
import { consumePendingDeepLink } from '@/lib/pending-deep-link';
import { useAuthStore } from '@/stores/use-auth-store';
import { withAlpha } from '@/theme/color-utils';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

const LOGO_SIZE = 72;
const SHEET_RADIUS = 28;
const SHEET_OVERLAP = 24;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing, elevation } = useTheme();
  const reducedMotion = useReducedMotion();
  const setSignedIn = useAuthStore((state) => state.setSignedIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<TextInputInstance>(null);

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
      // A captured deep link is an arbitrary runtime string, not a route this app's typed-routes
      // manifest can know statically — `Href` (rather than `as never`) is expo-router's own type
      // for exactly this "any valid path string" case.
      router.replace((pendingDeepLink ?? '/') as Href);
    } catch (err) {
      setError(describeAuthError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <Screen edges={['bottom']} style={{ backgroundColor: colors.surface1 }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <SignInHero />
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.springify()}
            style={[
              styles.sheet,
              elevation[3],
              {
                backgroundColor: colors.surface1,
                padding: spacing.lg,
                gap: spacing.md,
                marginTop: -SHEET_OVERLAP,
              },
            ]}
          >
            <View style={{ gap: spacing.xs }}>
              <Text variant="heading">{t('auth.welcomeBack')}</Text>
              <Text variant="body" color="secondary">
                {t('auth.signInSubtitle')}
              </Text>
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              leadingIcon="mail"
              placeholder={t('auth.emailPlaceholder')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            <View style={{ gap: spacing.xs }}>
              <TextField
                ref={passwordInputRef}
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                leadingIcon="lock"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                blurOnSubmit
                onSubmitEditing={handleSubmit}
                trailingIcon={isPasswordVisible ? 'eye-off' : 'eye'}
                trailingIconAccessibilityLabel={
                  isPasswordVisible ? t('auth.hidePassword') : t('auth.showPassword')
                }
                onTrailingIconPress={() => setIsPasswordVisible((visible) => !visible)}
              />
              <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
                <Text variant="callout" color="brand">
                  {t('auth.forgotPassword')}
                </Text>
              </Link>
            </View>

            <Button
              label={t('auth.signIn')}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              size="lg"
              fullWidth
            />

            <View style={[styles.dividerRow, { gap: spacing.sm }]}>
              <View style={styles.dividerLine}>
                <Divider />
              </View>
              <Text variant="caption" color="secondary">
                {t('auth.or')}
              </Text>
              <View style={styles.dividerLine}>
                <Divider />
              </View>
            </View>
            <SocialButtons />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Brand-colored hero: logo tile, app name and tagline over soft decorative rings. */
function SignInHero() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const appName = Constants.expoConfig?.name ?? 'ChatbotX';
  const ringColor = withAlpha(colors.onBrand, 0.08);

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(400)}
      style={[
        styles.hero,
        {
          backgroundColor: colors.brand,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: spacing.xxl + SHEET_OVERLAP,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.ring, styles.ringLarge, { borderColor: ringColor }]}
      />
      <View
        pointerEvents="none"
        style={[styles.ring, styles.ringSmall, { borderColor: ringColor }]}
      />
      <View
        style={[
          styles.logoTile,
          { backgroundColor: colors.onBrand, borderRadius: radius.xl, marginBottom: spacing.xs },
        ]}
      >
        <BrandLogo size={LOGO_SIZE * 0.6} color={colors.brand} />
      </View>
      <Text variant="heading" color="onBrand">
        {appName}
      </Text>
      <Text variant="callout" color="onBrand" style={styles.tagline}>
        {t('auth.heroTagline')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  ringLarge: {
    width: 320,
    height: 320,
    top: -120,
    end: -100,
  },
  ringSmall: {
    width: 180,
    height: 180,
    bottom: -40,
    start: -60,
  },
  logoTile: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    opacity: 0.8,
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    borderTopStartRadius: SHEET_RADIUS,
    borderTopEndRadius: SHEET_RADIUS,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
  },
});
