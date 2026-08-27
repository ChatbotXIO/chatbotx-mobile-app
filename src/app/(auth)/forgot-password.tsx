import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { requestPasswordReset } from '@/api/auth-endpoints';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/theme/use-theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <Screen padded>
        <EmptyState
          icon="checkmark-circle"
          title={t('auth.forgotPassword')}
          description={t('auth.resetLinkSent')}
          action={{ label: t('auth.backToSignIn'), onPress: () => router.back() }}
        />
      </Screen>
    );
  }

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
            <Text variant="heading">{t('auth.forgotPassword')}</Text>
            <Text variant="body" color="secondary">
              {t('auth.forgotPasswordSubtitle')}
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
              returnKeyType="go"
              blurOnSubmit
              onSubmitEditing={handleSubmit}
            />
            <Button
              label={t('auth.sendResetLink')}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={email.trim().length === 0 || isSubmitting}
              size="lg"
              fullWidth
            />
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
});
