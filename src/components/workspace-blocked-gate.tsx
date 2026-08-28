import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSwitchWorkspace } from '@/features/workspaces/api/use-switch-workspace';
import { useTheme } from '@/theme/use-theme';

import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface WorkspaceBlockedGateProps {
  reason: 'mac' | 'trialExpired' | 'unknown';
  message: string;
}

/**
 * Full-screen state for a 402 `workspaceBlocked` error on a workspace-scoped screen query (e.g.
 * the conversations list itself failing, not just a composer send — quota-banner.tsx already
 * handles the send-time case locally). Distinguishes MAC-limit vs trial-expired copy, with a
 * "switch workspace" escape hatch mirroring the settings screen's own switch flow.
 */
export function WorkspaceBlockedGate({ reason, message }: WorkspaceBlockedGateProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const switchWorkspace = useSwitchWorkspace();

  const copy =
    reason === 'mac'
      ? t('errors.workspaceBlockedMac')
      : reason === 'trialExpired'
        ? t('errors.workspaceBlockedTrialExpired')
        : message;

  function handleSwitchWorkspace() {
    switchWorkspace(null);
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Icon name="lock-closed-outline" size={40} color={colors.textSecondary} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        {t('errors.workspaceBlockedTitle')}
      </Text>
      <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
        {copy}
      </Text>
      <Button label={t('settings.switchWorkspace')} onPress={handleSwitchWorkspace} />
    </View>
  );
}
