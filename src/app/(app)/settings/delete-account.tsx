import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

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
import { useTheme } from '@/theme/use-theme';

function describeDeleteError(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.body.code === ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE) {
    return t('settings.deleteAccountSupportRequired');
  }
  return t('settings.deleteAccountFailed');
}

/** In-app account deletion: the user must type DELETE before the destructive button enables. */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const showToast = useToast();
  const [confirmation, setConfirmation] = useState('');
  const deleteAccount = useDeleteAccount();

  const isConfirmed = confirmation === ACCOUNT_DELETION_CONFIRMATION;

  function submit() {
    if (!isConfirmed || deleteAccount.isPending) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => showToast({ message: t('settings.deleteAccountScheduled'), tone: 'info' }),
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

        <View style={styles.actions}>
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

const styles = StyleSheet.create({
  actions: { gap: 8 },
});
