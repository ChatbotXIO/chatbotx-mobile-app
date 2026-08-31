import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SearchBar } from '@/components/ui/search-bar';
import { SheetModal } from '@/components/ui/sheet';
import { useSavedReplies } from '@/features/chat/api/use-saved-replies';

interface SavedRepliesSheetProps {
  workspaceId: string;
  onSelect: (text: string) => void;
}

/** Search-then-edit-before-send per the plan: tapping a reply fills the composer with its text
 * (via onSelect) rather than sending immediately, so the agent can adjust it first. */
export const SavedRepliesSheet = forwardRef<BottomSheetModal, SavedRepliesSheetProps>(
  function SavedRepliesSheet({ workspaceId, onSelect }, ref) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const { data: replies } = useSavedReplies(workspaceId);

    const filtered = (replies ?? []).filter(
      (reply) =>
        reply.shortcut.toLowerCase().includes(search.toLowerCase()) ||
        reply.text.toLowerCase().includes(search.toLowerCase()),
    );

    return (
      <SheetModal ref={ref} snapPoints={['60%', '90%']}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('chat.searchSavedReplies')}
        />
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(reply) => reply.id}
          ListEmptyComponent={<EmptyState title={t('chat.noSavedReplies')} />}
          renderItem={({ item }) => (
            <ListItem
              title={item.shortcut}
              subtitle={item.text}
              onPress={() => onSelect(item.text)}
            />
          )}
        />
      </SheetModal>
    );
  },
);
