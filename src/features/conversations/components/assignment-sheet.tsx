import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { Sheet } from '@/components/ui/sheet';
import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/** `GET /workspaces/{workspaceId}/members` — confirmed live in the generated schema, so this is a
 * real (not stubbed) member list, not the deferred Phase 8 members *management* screen. */
function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.members.list(workspaceId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/members', {
        params: { path: { workspaceId } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}

interface AssignmentSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
  workspaceId: string;
  onAssign: (userId: string | null) => void;
}

export function AssignmentSheet({ sheetRef, workspaceId, onAssign }: AssignmentSheetProps) {
  const { t } = useTranslation();
  const { data: members } = useWorkspaceMembers(workspaceId);

  return (
    <Sheet ref={sheetRef} snapPoints={['50%', '80%']}>
      <BottomSheetFlatList
        data={members ?? []}
        keyExtractor={(member) => member.id}
        ListHeaderComponent={
          <ListItem
            title={t('conversations.unassign')}
            onPress={() => {
              onAssign(null);
              sheetRef.current?.close();
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={t('settings.noMembers')}
            description={t('conversations.noOtherMembers')}
          />
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.user.name ?? t('conversations.unnamed')}
            leading={
              <Avatar
                uri={item.user.image}
                name={item.user.name ?? t('conversations.unnamed')}
                size={36}
              />
            }
            onPress={() => {
              onAssign(item.userId);
              sheetRef.current?.close();
            }}
          />
        )}
      />
    </Sheet>
  );
}
