import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SheetModal } from '@/components/ui/sheet';
import { useWorkspaceMembersList } from '@/features/permissions/use-permissions';

interface AssignmentSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  onAssign: (userId: string | null) => void;
}

export function AssignmentSheet({ sheetRef, workspaceId, onAssign }: AssignmentSheetProps) {
  const { t } = useTranslation();
  const { data: members } = useWorkspaceMembersList(workspaceId);

  return (
    <SheetModal ref={sheetRef} snapPoints={['50%', '80%']}>
      <BottomSheetFlatList
        data={members ?? []}
        keyExtractor={(member) => member.id}
        ListHeaderComponent={
          <ListItem
            title={t('conversations.unassign')}
            onPress={() => {
              onAssign(null);
              sheetRef.current?.dismiss();
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
              sheetRef.current?.dismiss();
            }}
          />
        )}
      />
    </SheetModal>
  );
}
