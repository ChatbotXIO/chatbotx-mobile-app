import type BottomSheet from '@gorhom/bottom-sheet';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/surface';
import { Divider } from '@/components/ui/divider';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useSignOut } from '@/features/auth/use-sign-out';
import {
  useRegisterDeviceToken,
  useUnregisterDeviceToken,
} from '@/features/settings/api/use-device-token';
import { LanguageSheet } from '@/features/settings/components/language-sheet';
import { WorkspaceSwitcherSheet } from '@/features/workspaces/components/workspace-switcher-sheet';
import { useWorkspaces } from '@/features/workspaces/api/use-workspaces';
import { localeMeta } from '@/i18n/locales';
import { useReducedMotion } from '@/theme/motion';
import { useResolvedScheme, useTheme } from '@/theme/use-theme';
import { useAuthStore } from '@/stores/use-auth-store';
import type { ThemePreference } from '@/stores/use-settings-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

const appVersion = Constants.expoConfig?.version ?? null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const scheme = useResolvedScheme();
  const reducedMotion = useReducedMotion();

  const user = useAuthStore((state) => state.user);
  const signOut = useSignOut();

  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const language = useSettingsStore((state) => state.language);

  const languageSheetRef = useRef<BottomSheet>(null);
  const workspaceSwitcherSheetRef = useRef<BottomSheet>(null);

  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find((workspace) => workspace.id === currentWorkspaceId);

  // Persisted user *intent* — the effective toggle state also depends on OS permission, which
  // can be revoked outside the app, so this isn't the only source of truth for what's displayed.
  // Token rotation itself (re-registering on a new Expo push token) is handled once, workspace-
  // aware, in the tabs layout — this screen only owns the on/off toggle and its mutations.
  const pushEnabled = useSettingsStore((state) => state.pushEnabled);
  const setPushEnabled = useSettingsStore((state) => state.setPushEnabled);
  const registerDeviceToken = useRegisterDeviceToken(currentWorkspaceId ?? '');
  const unregisterDeviceToken = useUnregisterDeviceToken();

  async function handleTogglePush(value: boolean) {
    if (!value) {
      setPushEnabled(false);
      unregisterDeviceToken.mutate();
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'denied' && !permission.canAskAgain) {
      // Denied-forever: the OS won't show the prompt again — only Settings can flip it.
      Linking.openSettings();
      return;
    }

    registerDeviceToken.mutate(undefined, {
      onSuccess: () => setPushEnabled(true),
      onError: () => setPushEnabled(false),
    });
  }

  return (
    <Screen edges={['top']}>
      <Animated.View
        key={reducedMotion ? undefined : scheme}
        entering={reducedMotion ? undefined : FadeIn.duration(200)}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
          <Text variant="display">{t('settings.title')}</Text>

          <Card>
            <ListItem
              title={user?.name ?? user?.email ?? t('settings.profile')}
              subtitle={user?.name ? user.email : undefined}
              leading={<Avatar name={user?.name ?? user?.email ?? '?'} size={56} />}
              onPress={() => router.push('/(app)/profile')}
              showChevron
            />
          </Card>

          <View>
            <SectionHeader title={t('settings.workspace')} />
            <Card>
              <ListItem
                title={t('settings.switchWorkspace')}
                value={currentWorkspace?.name}
                leading={
                  currentWorkspace ? (
                    <Avatar uri={currentWorkspace.logo} name={currentWorkspace.name} size={36} />
                  ) : undefined
                }
                onPress={() => workspaceSwitcherSheetRef.current?.expand()}
                showChevron
              />
              <Divider inset />
              <ListItem
                title={t('settings.members')}
                onPress={() => router.push('/(app)/settings/members')}
                showChevron
              />
            </Card>
            <WorkspaceSwitcherSheet ref={workspaceSwitcherSheetRef} />
          </View>

          <View>
            <SectionHeader title={t('settings.appearance')} />
            <Card>
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.ms }}>
                <Text variant="body" style={{ marginBottom: spacing.xs }}>
                  {t('settings.theme')}
                </Text>
                <SegmentedTabs<ThemePreference>
                  options={[
                    { value: 'system', label: t('settings.themeSystem') },
                    { value: 'light', label: t('settings.themeLight') },
                    { value: 'dark', label: t('settings.themeDark') },
                  ]}
                  value={themePreference}
                  onChange={setThemePreference}
                />
              </View>
              <Divider inset />
              <ListItem
                title={t('settings.language')}
                value={localeMeta[language].nativeLabel}
                onPress={() => languageSheetRef.current?.expand()}
                showChevron
              />
            </Card>
            <LanguageSheet sheetRef={languageSheetRef} currentLanguage={language} />
          </View>

          <View>
            <SectionHeader title={t('settings.notifications')} />
            <Card>
              <ToggleRow
                label={t('settings.pushNotifications')}
                description={t('settings.pushNotificationsDescription')}
                value={pushEnabled}
                onValueChange={(value) => void handleTogglePush(value)}
                disabled={registerDeviceToken.isPending || unregisterDeviceToken.isPending}
              />
            </Card>
          </View>

          <Card>
            <ListItem title={t('auth.signOut')} onPress={signOut} destructive />
          </Card>

          {appVersion ? (
            <Text
              variant="micro"
              color="tertiary"
              style={{ textAlign: 'center', marginTop: spacing.sm }}
            >
              {t('settings.version', { version: appVersion })}
            </Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}
