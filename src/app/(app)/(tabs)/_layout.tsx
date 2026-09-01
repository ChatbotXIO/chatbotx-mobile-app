import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useInboxUnreadCount } from '@/features/conversations/api/use-inbox-unread-count';
import { usePushTokenRotation } from '@/features/settings/api/use-device-token';
import { RealtimeProvider } from '@/realtime/realtime-provider';
import { useSettingsStore } from '@/stores/use-settings-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/** react-navigation types tabBarIcon's `color` as `ColorValue` (includes opaque platform colors);
 * our theme tokens are always plain hex strings, so this casts back for the Icon primitive.
 * `strokeWidth` bumps to 2.5 when focused — lucide icons are stroke-only, so this is how the
 * active tab recovers the visual weight Ionicons' filled/outline pair used to convey. */
function tabIcon(name: IconName) {
  function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Icon name={name} size={size} color={color as string} strokeWidth={focused ? 2.5 : 2} />;
  }
  return TabIcon;
}

/** Tabs shell: guarded on having a selected workspace, wraps children in the realtime provider so
 * every tab screen gets live updates. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const pushEnabled = useSettingsStore((state) => state.pushEnabled);
  const unreadCount = useInboxUnreadCount(currentWorkspaceId);

  // Lives here (not in Settings) so it re-registers the device token for whichever workspace is
  // currently active, including after an inline workspace switch — the toggle itself stays a
  // Settings-owned control (see settings/index.tsx's ToggleRow + its own register/unregister
  // mutations for the user-initiated on/off path).
  usePushTokenRotation(currentWorkspaceId ?? '', pushEnabled);

  if (!currentWorkspaceId) {
    return <Redirect href="/(app)/workspace-picker" />;
  }

  return (
    <RealtimeProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.surface1, borderTopColor: colors.borderSubtle },
        }}
      >
        <Tabs.Screen
          name="conversations/index"
          options={{
            title: t('inbox.title'),
            tabBarIcon: tabIcon('messages-square'),
            // `useInboxUnreadCount` only counts CACHED list pages, not a true server-side unread
            // total (no such endpoint exists yet — see the hook's own doc comment). `undefined`
            // (not 0) hides the badge entirely when there's nothing unread.
            tabBarBadge: unreadCount || undefined,
          }}
        />
        <Tabs.Screen
          name="contacts/index"
          options={{ title: t('contacts.title'), tabBarIcon: tabIcon('users') }}
        />
        <Tabs.Screen
          name="settings/index"
          options={{ title: t('settings.title'), tabBarIcon: tabIcon('settings') }}
        />
      </Tabs>
    </RealtimeProvider>
  );
}
