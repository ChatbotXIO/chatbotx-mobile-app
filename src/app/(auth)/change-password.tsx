import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInput } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { changePassword } from '@/api/auth-endpoints';
import { getAuthToken } from '@/api/auth-token';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/theme/use-theme';

/**
 * Forced password-change screen — reached when the session user has `mustChangePassword: true`
 * (reseller-provisioned temporary password). Every other oRPC/session-authenticated call is
 * blocked server-side until this completes, so this screen has no way out except a successful
 * change.
 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const setMustChangePassword = useAuthStore((state) => state.setMustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newPasswordInputRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error(t('errors.unauthorized'));
      }
      await changePassword(token, currentPassword, newPassword);
      setMustChangePassword(false);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && !isSubmitting;

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
            <Text variant="heading">{t('auth.changePassword')}</Text>
            <Text variant="body" color="secondary">
              {t('auth.changePasswordRequired')}
            </Text>

            {error ? <ErrorBanner message={error} /> : null}

            <TextField
              label={t('auth.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!isCurrentPasswordVisible}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => newPasswordInputRef.current?.focus()}
              trailingIcon={isCurrentPasswordVisible ? 'eye-off' : 'eye'}
              trailingIconAccessibilityLabel={
                isCurrentPasswordVisible ? t('auth.hidePassword') : t('auth.showPassword')
              }
              onTrailingIconPress={() => setIsCurrentPasswordVisible((visible) => !visible)}
            />
            <TextField
              ref={newPasswordInputRef}
              label={t('auth.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!isNewPasswordVisible}
              autoCapitalize="none"
              textContentType="newPassword"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSubmit}
              trailingIcon={isNewPasswordVisible ? 'eye-off' : 'eye'}
              trailingIconAccessibilityLabel={
                isNewPasswordVisible ? t('auth.hidePassword') : t('auth.showPassword')
              }
              onTrailingIconPress={() => setIsNewPasswordVisible((visible) => !visible)}
            />

            <Button
              label={t('auth.changePassword')}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
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
