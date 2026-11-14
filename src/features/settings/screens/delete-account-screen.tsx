import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE,
  useDeleteAccount,
} from '@/features/settings/api/use-delete-account';
import { isNetworkError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

function describeDeleteError(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.body.code === ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE) {
    return t('settings.deleteAccountSupportRequired');
  }
  if (isNetworkError(error)) return t('errors.network');
  return t('settings.deleteAccountFailed');
}

/** In-app account deletion: the user must type DELETE before the destructive button enables. */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const showToast = useToast();
  const [confirmation, setConfirmation] = useState('');
  const deleteAccount = useDeleteAccount();

  const isConfirmed = confirmation === ACCOUNT_DELETION_CONFIRMATION;

  function submit() {
    if (!isConfirmed || deleteAccount.isPending) return;
    // Not `mutate(_, { onSuccess })`: the hook signs out on success, which unmounts this screen,
    // and react-query skips per-call callbacks once the observer is gone. The awaited promise
    // still settles, and the toast host lives at the root, so the toast survives the redirect.
    deleteAccount
      .mutateAsync()
      .then(() => showToast({ message: t('settings.deleteAccountScheduled'), tone: 'info' }))
      .catch(() => {
        // Surfaced through `deleteAccount.error` in the banner below.
      });
  }

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title">{t('settings.deleteAccountTitle')}</Text>
        <Text color="secondary">{t('settings.deleteAccountBody')}</Text>

        <TextField
          label={t('settings.deleteAccountConfirmLabel')}
          placeholder={t('settings.deleteAccountConfirmHint')}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleteAccount.isPending}
        />

        {deleteAccount.isError ? (
          <ErrorBanner message={describeDeleteError(deleteAccount.error, t)} />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('settings.deleteAccountSubmit')}
            variant="danger"
            fullWidth
            disabled={!isConfirmed}
            loading={deleteAccount.isPending}
            onPress={submit}
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            fullWidth
            disabled={deleteAccount.isPending}
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
