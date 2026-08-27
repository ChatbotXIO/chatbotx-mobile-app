import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { signOut as signOutRequest } from '@/api/auth-endpoints';
import { clearAuthToken, getAuthToken } from '@/api/auth-token';
import { Avatar } from '@/components/ui/avatar';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/** Profile modal: identity + plan placeholder + sign-out. Dark-mode/language live on the settings
 * tab (this modal doesn't duplicate them) since there's no plan/billing API yet to justify a
 * separate "account" surface beyond identity. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const user = useAuthStore((state) => state.user);
  const setSignedOut = useAuthStore((state) => state.setSignedOut);
  const setCurrentWorkspaceId = useWorkspaceStore((state) => state.setCurrentWorkspaceId);

  async function handleSignOut() {
    const token = await getAuthToken();
    if (token) {
      await signOutRequest(token).catch(() => {});
    }
    await clearAuthToken();
    queryClient.clear();
    setCurrentWorkspaceId(null);
    setSignedOut();
  }

  return (
    <Screen padded>
      <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Avatar name={user?.name ?? user?.email ?? '?'} size={72} />
        <Text variant="title">{user?.name ?? user?.email}</Text>
        {user?.name ? (
          <Text variant="caption" color="secondary">
            {user.email}
          </Text>
        ) : null}
      </View>

      <SectionHeader title={t('profile.plan')} />
      <ListItem title={t('profile.plan')} subtitle="—" />

      <SectionHeader title="" />
      <ListItem title={t('auth.signOut')} onPress={handleSignOut} />
    </Screen>
  );
}
