import type BottomSheet from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
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
  const showToast = useToast();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [keyword, setKeyword] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const actionsSheetRef = useRef<BottomSheet>(null);
  // `ContactActionsSheet` only mounts once `selectedContactDetail` resolves (see the render guard
  // below), so `actionsSheetRef.current` is still null on the render triggered by `openActions` —
  // calling `.expand()` synchronously there is a no-op on the first tap for any given contact.
  // This ref defers the actual `.expand()` call to the effect below, which fires once the sheet
  // has actually mounted. A ref (not state) so clearing it doesn't itself trigger another render.
  const pendingOpenRef = useRef(false);

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

  useEffect(() => {
    if (pendingOpenRef.current && workspaceId && selectedContactDetail) {
      actionsSheetRef.current?.expand();
      pendingOpenRef.current = false;
    }
  }, [workspaceId, selectedContactDetail]);

  const openActions = useCallback((contact: ContactListItem) => {
    setSelectedContact(contact);
    pendingOpenRef.current = true;
  }, []);

  // Stable per-action handlers (not per-item inline arrows) so `ContactRow`'s `memo` can actually
  // short-circuit — an inline arrow in `renderItem` would be a new function reference on every
  // list render regardless of whether a given row's own data changed, defeating memo entirely.
  const handlePress = useCallback(
    (contact: ContactListItem) => router.push(`/(app)/contacts/${contact.id}`),
    [router],
  );

  const handleToggleBlock = useCallback(
    (contact: ContactListItem) => {
      const wasBlocked = Boolean(contact.blockedAt);
      const mutation = wasBlocked ? unblockContact : blockContact;
      mutation.mutate(contact.id, {
        onSuccess: () => {
          showToast({
            message: wasBlocked ? t('contacts.unblockedSuccess') : t('contacts.blockedSuccess'),
            tone: 'success',
          });
        },
        onError: (error) => {
          showToast({ message: describeApiError(error, t), tone: 'danger' });
        },
      });
    },
    [unblockContact, blockContact, showToast, t],
  );

  const handleDelete = useCallback(
    (contact: ContactListItem) => {
      deleteContact.mutate(contact.id, {
        onSuccess: () => {
          showToast({ message: t('contacts.deleted'), tone: 'success' });
        },
        onError: (error) => {
          showToast({ message: describeApiError(error, t), tone: 'danger' });
        },
      });
    },
    [deleteContact, showToast, t],
  );

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
              onPress={handlePress}
              onOpenActions={openActions}
              onToggleBlock={handleToggleBlock}
              onDelete={handleDelete}
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
