import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  useAddContactTag,
  useWorkspaceTags,
  type WorkspaceTag,
} from '@/features/contacts/api/use-contact-tags';
import { useTheme } from '@/theme/use-theme';

interface TagPickerSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
  workspaceId: string;
  contact: ContactDetail;
}

/** Available-tags picker extracted from `TagsTab`'s inline "add tag" list — same behavior (tap
 * adds the tag, optimistic via `useAddContactTag`), but as a standalone sheet so
 * `ContactActionsSheet`'s "Set tags" entry can open it without duplicating the fetch/filter
 * logic. `TagsTab` keeps its own inline add-list too; both read the same catalog/assigned-tags
 * data, no behavior change to either. */
export function TagPickerSheet({ sheetRef, workspaceId, contact }: TagPickerSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: catalog } = useWorkspaceTags(workspaceId);
  const addTag = useAddContactTag(workspaceId, contact.id);

  const assignedIds = new Set(contact.tags.map((tag) => tag.id));
  const available = (catalog ?? []).filter((tag) => !assignedIds.has(tag.id));

  function handleSelect(tag: WorkspaceTag) {
    addTag.mutate(tag);
    sheetRef.current?.close();
  }

  return (
    <Sheet ref={sheetRef} snapPoints={['50%', '80%']}>
      <SheetHeader title={t('contacts.setTags')} onClose={() => sheetRef.current?.close()} />
      <BottomSheetFlatList
        data={available}
        keyExtractor={(tag) => tag.id}
        ListEmptyComponent={<EmptyState icon="tag" title={t('contacts.noTags')} />}
        renderItem={({ item }: { item: WorkspaceTag }) => (
          <ListItem
            title={item.name}
            trailing={<Icon name="circle-plus" size={20} color={colors.brand} />}
            onPress={() => handleSelect(item)}
          />
        )}
      />
    </Sheet>
  );
}
