import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { signOut as signOutRequest } from '@/api/auth-endpoints';
import { clearAuthToken, getAuthToken } from '@/api/auth-token';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/** Single source of truth for signing out, replacing the two near-identical blocks that used to
 * live in profile.tsx (no confirmation, not destructive) and settings/index.tsx (confirmed,
 * destructive). Both call sites now get the same confirm-then-clear-everything behavior:
 * best-effort server-side session revoke, clear the stored token, drop every cached query (it's
 * all workspace/session-scoped), clear the selected workspace, then flip the auth store to
 * signed-out. */
export function useSignOut() {
  const { t } = useTranslation();
  const setSignedOut = useAuthStore((state) => state.setSignedOut);
  const setCurrentWorkspaceId = useWorkspaceStore((state) => state.setCurrentWorkspaceId);

  async function performSignOut() {
    const token = await getAuthToken();
    if (token) {
      await signOutRequest(token).catch(() => {});
    }
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
