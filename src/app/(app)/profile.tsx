import { View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/theme/use-theme';
import { useTranslation } from 'react-i18next';

/** Profile modal: identity + sign-out. Dark-mode/language live on the settings tab (this modal
 * doesn't duplicate them) since there's no plan/billing API yet to justify a separate "account"
 * surface beyond identity. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useSignOut();

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

      <ListItem title={t('auth.signOut')} onPress={signOut} destructive />
    </Screen>
  );
}
