import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/stores/use-auth-store';

/** App route group: gated on an active session. A must-change-password user is trapped in
 * `(auth)/change-password` (that layout's own logic), so reaching here implies the gate is clear. */
export default function AppLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);

  if (status !== 'signed-in') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="workspace-picker" />
      <Stack.Screen
        name="profile"
        options={{ presentation: 'modal', headerShown: true, title: t('settings.profile') }}
      />
      <Stack.Screen name="conversations/[conversationId]/index" />
      <Stack.Screen
        name="conversations/[conversationId]/contact"
        options={{ headerShown: true, title: t('contacts.contactTitle') }}
      />
      <Stack.Screen
        name="settings/members"
        options={{ headerShown: true, title: t('settings.members') }}
      />
    </Stack>
  );
}
