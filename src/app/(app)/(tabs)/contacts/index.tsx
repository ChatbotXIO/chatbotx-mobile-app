import type BottomSheet from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { useContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  flattenContactPages,
  useContactsInfinite,
  type ContactListItem,
} from '@/features/contacts/api/use-contacts-infinite';
import { ContactActionsSheet } from '@/features/contacts/components/contact-actions-sheet';
import { ContactRow, contactRowItemType } from '@/features/contacts/contact-row';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

const SEARCH_DEBOUNCE_MS = 350;

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [openRequest, setOpenRequest] = useState(0);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const actionsSheetRef = useRef<BottomSheet>(null);
  // `ContactActionsSheet` only mounts once `selectedContactDetail` resolves (see the render guard
  // below), so `actionsSheetRef.current` is still null on the render triggered by `openActions` —
  // calling `.expand()` synchronously there is a no-op on the first tap for any given contact.
  // This ref defers the actual `.expand()` call to the effect below, which fires once the sheet
  // has actually mounted. A ref (not state) so clearing it doesn't itself trigger another render.
  const pendingOpenRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setKeyword(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const query = useContactsInfinite(workspaceId, keyword);
  const totalCount = query.data?.pages[0]?.totalCount ?? null;
  const contacts = flattenContactPages(query.data?.pages);
  const normalizedError = query.error ? normalizeApiError(query.error) : null;

  const { data: selectedContactDetail } = useContactDetail(
    workspaceId,
    selectedContact?.id ?? null,
  );

  // `openRequest` is bumped on every "More" tap so the effect re-runs even when the same contact is
  // tapped again (same `selectedContact`, cached detail → no other dep would change).
  useEffect(() => {
    if (!pendingOpenRef.current || !workspaceId || !selectedContactDetail) return;
    pendingOpenRef.current = false;
    // The sheet may have mounted in this very commit; @gorhom/bottom-sheet ignores `expand()` until
    // its first layout pass, so defer one frame.
    requestAnimationFrame(() => actionsSheetRef.current?.expand());
  }, [workspaceId, selectedContactDetail, openRequest]);

  const openActions = useCallback((contact: ContactListItem) => {
    setSelectedContact(contact);
    pendingOpenRef.current = true;
    setOpenRequest((n) => n + 1);
  }, []);

  // Stable per-action handlers (not per-item inline arrows) so `ContactRow`'s `memo` can actually
  // short-circuit — an inline arrow in `renderItem` would be a new function reference on every
  // list render regardless of whether a given row's own data changed, defeating memo entirely.
  const handlePress = useCallback(
    (contact: ContactListItem) => router.push(`/(app)/contacts/${contact.id}`),
    [router],
  );

  const handleMessage = useCallback(
    (contact: ContactListItem) => {
      const conversationId = contact.conversation?.id;
      if (conversationId) router.push(`/(app)/conversations/${conversationId}`);
    },
    [router],
  );

  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} message={normalizedError.message} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={{ backgroundColor: colors.surface1 }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
        <View style={[styles.titleRow, { gap: spacing.sm }]}>
          <Text variant="display" accessibilityRole="header">
            {t('contacts.title')}
          </Text>
          {totalCount !== null ? (
            <Text variant="caption" color="tertiary" numeric>
              {totalCount.toLocaleString()}
            </Text>
          ) : null}
        </View>
        <SearchBar
          pill
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('contacts.searchPlaceholder')}
        />
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
        <EmptyState
          icon={keyword ? 'search' : 'users'}
          title={keyword ? t('contacts.emptySearch') : t('contacts.empty')}
        />
      ) : (
        <FlashList
          data={contacts}
          keyExtractor={(contact) => contact.id}
          getItemType={contactRowItemType}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              workspaceId={workspaceId}
              onPress={handlePress}
              onOpenActions={openActions}
              onMessage={handleMessage}
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
              onRefresh={() => void query.refetch()}
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
          conversationId={selectedContact?.conversation?.id}
          onDeleted={() => setSelectedContact(null)}
          onClose={() => actionsSheetRef.current?.close()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
