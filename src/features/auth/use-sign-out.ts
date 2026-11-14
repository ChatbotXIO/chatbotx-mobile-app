import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { revokeMobileToken } from '@/api/auth-endpoints';
import { clearAuthToken } from '@/api/auth-token';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

interface SignOutLocallyOptions {
  /** Best-effort server-side token revocation. Skip when the server already revoked everything. */
  revokeToken?: boolean;
}

/**
 * Tears down the local session without any confirmation UI: clears the credential pair, every
 * cached query and the selected workspace, then flips the auth store so the gate routes to sign-in.
 */
export function useSignOutLocally() {
  const setSignedOut = useAuthStore((state) => state.setSignedOut);
  const setCurrentWorkspaceId = useWorkspaceStore((state) => state.setCurrentWorkspaceId);

  return async function signOutLocally({ revokeToken = true }: SignOutLocallyOptions = {}) {
    if (revokeToken) {
      await revokeMobileToken().catch(() => {});
    }
    await clearAuthToken();
    queryClient.clear();
    setCurrentWorkspaceId(null);
    setSignedOut();
  };
}

/**
 * Confirms, then signs out. Revocation is best-effort so logging out still succeeds offline.
 */
export function useSignOut() {
  const { t } = useTranslation();
  const signOutLocally = useSignOutLocally();

  return function signOut() {
    Alert.alert(t('auth.signOutConfirmTitle'), t('auth.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => void signOutLocally() },
    ]);
  };
}
