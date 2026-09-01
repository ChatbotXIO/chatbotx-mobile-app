import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import type { FlowListItem } from '@/features/flows/api/use-flows';
import { useFlows } from '@/features/flows/api/use-flows';

interface FlowPickerSheetProps {
  workspaceId: string;
  onSelect: (flow: FlowListItem) => void;
  onClose: () => void;
}

/** "Send flow" composer entry: lists flows filtered to `active && enableInInbox` — per the plan's
 * verified backend note, only flows meeting both are valid to trigger from the inbox composer
 * (the endpoint doesn't reject others itself, but the web app applies this same filter when
 * building its own picker). */
export const FlowPickerSheet = forwardRef<BottomSheetModal, FlowPickerSheetProps>(
  function FlowPickerSheet({ workspaceId, onSelect, onClose }, ref) {
    const { t } = useTranslation();
    const { data, isLoading } = useFlows(workspaceId);

    const flows = useMemo(
      () => (data ?? []).filter((flow) => flow.active && flow.enableInInbox),
      [data],
    );

    return (
      <SheetModal ref={ref} snapPoints={['60%', '90%']} onDismiss={onClose}>
        <SheetHeader title={t('chat.sendFlow')} onClose={onClose} />
        <BottomSheetFlatList
          data={flows}
          keyExtractor={(flow) => flow.id}
          ListEmptyComponent={!isLoading ? <EmptyState title={t('flows.empty')} /> : null}
          renderItem={({ item }) => (
            <ListItem title={item.name} showChevron onPress={() => onSelect(item)} />
          )}
        />
      </SheetModal>
    );
  },
);
