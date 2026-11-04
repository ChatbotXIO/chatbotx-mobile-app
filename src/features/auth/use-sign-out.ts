import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { revokeMobileToken } from '@/api/auth-endpoints';
import { clearAuthToken } from '@/api/auth-token';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Clears the mobile credential pair and all workspace-scoped state. Revocation
 * is best-effort so logging out still succeeds offline.
 */
export function useSignOut() {
  const { t } = useTranslation();
  const setSignedOut = useAuthStore((state) => state.setSignedOut);
  const setCurrentWorkspaceId = useWorkspaceStore((state) => state.setCurrentWorkspaceId);

  async function performSignOut() {
    await revokeMobileToken().catch(() => {});
    await clearAuthToken();
    queryClient.clear();
    setCurrentWorkspaceId(null);
    setSignedOut();
  }

  return function signOut() {
    Alert.alert(t('auth.signOutConfirmTitle'), t('auth.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => void performSignOut() },
    ]);
  };
}
