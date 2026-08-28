import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { useAuthStore } from '@/stores/use-auth-store';

/** Catch-all for unmatched routes (bad deep link, stale link, typo'd path). Routes back to the
 * conversations tab if signed in, or sign-in otherwise — mirrors index.tsx's own redirect logic
 * rather than assuming an authed session. */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);

  function handleGoHome() {
    router.replace(status === 'signed-in' ? '/(app)/(tabs)/conversations' : '/(auth)/sign-in');
  }

  return (
    <Screen padded>
      <EmptyState
        icon="compass-outline"
        title={t('errors.notFoundTitle')}
        description={t('errors.notFoundBody')}
        action={{ label: t('errors.goHome'), onPress: handleGoHome }}
      />
    </Screen>
  );
}
