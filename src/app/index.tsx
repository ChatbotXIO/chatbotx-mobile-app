import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/**
 * Root redirect gate: !authed → sign-in; mustChangePassword → change-password; no workspace →
 * workspace-picker; else → tabs shell.
 */
export default function IndexRedirect() {
  const status = useAuthStore((state) => state.status);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword ?? false);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  if (status === 'pending') {
    return <LoadingScreen />;
  }

  if (status === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (mustChangePassword) {
    return <Redirect href="/(auth)/change-password" />;
  }

  if (!currentWorkspaceId) {
    return <Redirect href="/(app)/workspace-picker" />;
  }

  return <Redirect href="/(app)/(tabs)/conversations" />;
}

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
    </Screen>
  );
}
