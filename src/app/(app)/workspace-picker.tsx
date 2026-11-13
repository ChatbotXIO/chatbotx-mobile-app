import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { describeApiError } from '@/lib/describe-api-error';
import { Card } from '@/components/ui/surface';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { SkeletonRow } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useEnsureDefaultWorkspace } from '@/features/workspaces/api/use-ensure-default-workspace';
import { useSwitchWorkspace } from '@/features/workspaces/api/use-switch-workspace';
import { useWorkspaces, type Workspace } from '@/features/workspaces/api/use-workspaces';
import { WorkspaceRow } from '@/features/workspaces/workspace-row';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

export default function WorkspacePickerScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { data: workspaces, isPending, isError, isRefetching, error, refetch } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const ensureDefault = useEnsureDefaultWorkspace();
  const hasRequestedDefault = useRef(false);
  const isListEmpty = workspaces !== undefined && workspaces.length === 0;
  const { mutate: createDefaultWorkspace } = ensureDefault;

  const requestDefaultWorkspace = useCallback(() => {
    hasRequestedDefault.current = true;
    createDefaultWorkspace(undefined, {
      onSuccess: (workspace) => {
        if (workspace) switchWorkspace(workspace.id, { navigate: true });
      },
    });
  }, [createDefaultWorkspace, switchWorkspace]);

  // A brand-new account has no membership yet; web creates the first workspace lazily on its home
  // page, so mobile asks the (idempotent) backend to do the same once the list resolves empty.
  useEffect(() => {
    if (isListEmpty && !hasRequestedDefault.current) requestDefaultWorkspace();
  }, [isListEmpty, requestDefaultWorkspace]);

  function handleSelect(workspace: Workspace) {
    switchWorkspace(workspace.id, { navigate: true });
  }

  return (
    <Screen padded edges={['top']}>
      <Text variant="display" style={{ marginBottom: spacing.md }}>
        {t('workspaces.title')}
      </Text>

      {isPending || (isListEmpty && (ensureDefault.isPending || ensureDefault.isIdle)) ? (
        <View style={{ gap: spacing.sm }}>
          <SkeletonRow.Conversation />
          <SkeletonRow.Conversation />
          <SkeletonRow.Conversation />
        </View>
      ) : isError ? (
        <ErrorBanner
          message={describeApiError(error, t)}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      ) : isListEmpty && ensureDefault.isError ? (
        <ErrorBanner
          message={describeApiError(ensureDefault.error, t)}
          actionLabel={t('common.retry')}
          onAction={requestDefaultWorkspace}
        />
      ) : workspaces && workspaces.length > 0 ? (
        <FlatList
          data={workspaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card>
              <WorkspaceRow
                workspace={item}
                selected={item.id === currentWorkspaceId}
                onPress={handleSelect}
              />
            </Card>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.brand}
            />
          }
        />
      ) : (
        <EmptyState icon="building-2" title={t('workspaces.empty')} />
      )}
    </Screen>
  );
}
