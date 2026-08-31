import type BottomSheet from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { useContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  flattenContactPages,
  useContactsInfinite,
  type ContactListItem,
} from '@/features/contacts/api/use-contacts-infinite';
import { useDeleteContact } from '@/features/contacts/api/use-delete-contact';
import { useBlockContact, useUnblockContact } from '@/features/contacts/api/use-contact-block';
import { ContactActionsSheet } from '@/features/contacts/components/contact-actions-sheet';
import { ContactRow } from '@/features/contacts/contact-row';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [keyword, setKeyword] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const actionsSheetRef = useRef<BottomSheet>(null);

  const query = useContactsInfinite(workspaceId, keyword);
  const contacts = flattenContactPages(query.data?.pages);
  const normalizedError = query.error ? normalizeApiError(query.error) : null;

  const blockContact = useBlockContact(workspaceId ?? '');
  const unblockContact = useUnblockContact(workspaceId ?? '');
  const deleteContact = useDeleteContact(workspaceId ?? '');
  const { data: selectedContactDetail } = useContactDetail(
    workspaceId,
    selectedContact?.id ?? null,
  );

  function openActions(contact: ContactListItem) {
    setSelectedContact(contact);
    actionsSheetRef.current?.expand();
  }

  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} message={normalizedError.message} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
        <SearchBar value={keyword} onChangeText={setKeyword} placeholder={t('common.search')} />
      </View>

      {normalizedError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            message={describeApiError(query.error, t)}
            actionLabel={t('common.retry')}
            onAction={() => query.refetch()}
          />
        </View>
      ) : null}

      {query.isLoading ? (
        <View>
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonRow.Contact key={index} />
          ))}
        </View>
      ) : contacts.length === 0 ? (
        <EmptyState icon="users" title={t('contacts.empty')} />
      ) : (
        <FlashList
          data={contacts}
          keyExtractor={(contact) => contact.id}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              workspaceId={workspaceId}
              onPress={() => router.push(`/(app)/contacts/${item.id}`)}
              onOpenActions={() => openActions(item)}
              onToggleBlock={() => {
                if (item.blockedAt) {
                  unblockContact.mutate(item.id);
                } else {
                  blockContact.mutate(item.id);
                }
              }}
              onDelete={() => deleteContact.mutate(item.id)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.brand}
            />
          }
          ListFooterComponent={<ListFooterSpinner visible={query.isFetchingNextPage} />}
        />
      )}

      {workspaceId && selectedContactDetail ? (
        <ContactActionsSheet
          ref={actionsSheetRef}
          workspaceId={workspaceId}
          contact={selectedContactDetail}
          onClose={() => actionsSheetRef.current?.close()}
        />
      ) : null}
    </Screen>
  );
}
