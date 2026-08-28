import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/use-auth-store';

/** Auth route group: signed-in users never see these screens (redirect to `/`, whose own
 * redirect logic sends them to the tabs shell or mustChangePassword as appropriate). */
export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword ?? false);

  if (status === 'signed-in' && !mustChangePassword) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
