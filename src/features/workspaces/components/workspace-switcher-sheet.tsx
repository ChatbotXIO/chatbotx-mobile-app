import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { useSwitchWorkspace } from '@/features/workspaces/api/use-switch-workspace';
import { useWorkspaces, type Workspace } from '@/features/workspaces/api/use-workspaces';
import { WorkspaceRow } from '@/features/workspaces/workspace-row';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Inline workspace switcher, opened from the inbox header pill and from Settings' "Switch
 * workspace" row — replaces navigating away to the full-screen picker for the common case of
 * hopping between a small number of workspaces. Picking a DIFFERENT workspace confirms first
 * (switching drops every cached query for the current one), then switches and closes; picking the
 * already-active workspace just closes the sheet.
 */
export const WorkspaceSwitcherSheet = forwardRef<BottomSheet>(
  function WorkspaceSwitcherSheet(_props, ref) {
    const { t } = useTranslation();
    const { data: workspaces, isPending } = useWorkspaces();
    const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
    const switchWorkspace = useSwitchWorkspace();

    function closeSheet() {
      if (ref && 'current' in ref) {
        ref.current?.close();
      }
    }

    function handleSelect(workspace: Workspace) {
      if (workspace.id === currentWorkspaceId) {
        closeSheet();
        return;
      }

      Alert.alert(
        t('workspaces.switchConfirmTitle'),
        t('workspaces.switchConfirmBody', { name: workspace.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('workspaces.switch'),
            onPress: () => {
              switchWorkspace(workspace.id, { navigate: true });
              closeSheet();
            },
          },
        ],
      );
    }

    return (
      <Sheet ref={ref} snapPoints={['50%', '80%']}>
        <BottomSheetFlatList
          data={isPending ? [] : (workspaces ?? [])}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyState icon="building-2" title={t('workspaces.empty')} />}
          renderItem={({ item }) => (
            <WorkspaceRow
              workspace={item}
              selected={item.id === currentWorkspaceId}
              onPress={handleSelect}
            />
          )}
        />
      </Sheet>
    );
  },
);
