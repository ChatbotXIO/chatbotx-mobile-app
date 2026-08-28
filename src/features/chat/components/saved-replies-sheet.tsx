import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SearchBar } from '@/components/ui/search-bar';
import { Sheet } from '@/components/ui/sheet';
import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/** `GET /workspaces/{workspaceId}/saved-replies` — flat list, no cursor pagination (confirmed in
 * the generated schema: `{ data: { id, shortcut, text }[] }`), so a plain useQuery is enough. */
function useSavedReplies(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.savedReplies.list(workspaceId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/saved-replies', {
        params: { path: { workspaceId } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}

interface SavedRepliesSheetProps {
  workspaceId: string;
  onSelect: (text: string) => void;
}

/** Search-then-edit-before-send per the plan: tapping a reply fills the composer with its text
 * (via onSelect) rather than sending immediately, so the agent can adjust it first. */
export const SavedRepliesSheet = forwardRef<BottomSheet, SavedRepliesSheetProps>(
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
      <Sheet ref={ref} snapPoints={['60%', '90%']}>
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
      </Sheet>
    );
  },
);
