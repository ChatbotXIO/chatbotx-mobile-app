import type BottomSheet from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { ConnectionBanner } from '@/components/ui/connection-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { IconButton } from '@/components/ui/icon-button';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import {
  ConversationRow,
  conversationRowItemType,
} from '@/features/conversations/components/conversation-row';
import { FilterChipsRow } from '@/features/conversations/components/filter-chips-row';
import { FilterSheet } from '@/features/conversations/components/filter-sheet';
import {
  flattenConversationPages,
  useConversationsInfinite,
  type ConversationListItem,
} from '@/features/conversations/api/use-conversations-infinite';
import {
  useArchiveConversations,
  useAssignConversations,
  useDisableBot,
  useEnableBot,
  useMarkConversationRead,
  useMarkConversationUnread,
  useUnarchiveConversations,
} from '@/features/conversations/api/use-conversation-actions';
import { isBotActive, isUnread } from '@/features/conversations/lib/conversation-status';
import {
  conversationFiltersSnapshot,
  useConversationFilters,
} from '@/features/conversations/stores/use-conversation-filters';
import { WorkspaceSwitcherSheet } from '@/features/workspaces/components/workspace-switcher-sheet';
import { WorkspacePill } from '@/features/workspaces/components/workspace-pill';
import { useWorkspaces } from '@/features/workspaces/api/use-workspaces';
import { useConnectionBannerState } from '@/realtime/use-connection-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

const SEARCH_DEBOUNCE_MS = 350;
const SKELETON_ROW_COUNT = 8;

/** Count of active filter dimensions (excluding `keyword`, which has its own search bar affordance
 * and doesn't belong in the "how many filters are on" badge) — drives the filter IconButton's
 * `badgeCount`. */
function activeFilterCount(filters: ReturnType<typeof conversationFiltersSnapshot>): number {
  let count = 0;
  if (filters.botCategory) count += 1;
  if (filters.assignedId !== undefined) count += 1;
  if (filters.channel) count += 1;
  if (filters.status && filters.status.length > 0) count += 1;
  if (filters.botEnabled !== undefined && filters.botEnabled !== null) count += 1;
  return count;
}

export default function ConversationsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const showToast = useToast();
  const connectionState = useConnectionBannerState();

  const [searchText, setSearchText] = useState('');
  const setKeyword = useConversationFilters((state) => state.setKeyword);
  const resetFilters = useConversationFilters((state) => state.reset);
  const filtersSnapshot = useConversationFilters(useShallow(conversationFiltersSnapshot));
  const filterCount = activeFilterCount(filtersSnapshot);
  const [assigningConversation, setAssigningConversation] = useState<ConversationListItem | null>(
    null,
  );

  const filterSheetRef = useRef<BottomSheet>(null);
  const assignmentSheetRef = useRef<BottomSheet>(null);
  const workspaceSwitcherSheetRef = useRef<BottomSheet>(null);
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find((workspace) => workspace.id === workspaceId);

  useEffect(() => {
    const timeout = setTimeout(() => setKeyword(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchText, setKeyword]);

  const query = useConversationsInfinite(workspaceId);
  const conversations = flattenConversationPages(query.data?.pages);
  const assignMutation = useAssignConversations(workspaceId ?? '');
  const markRead = useMarkConversationRead(workspaceId ?? '');
  const markUnread = useMarkConversationUnread(workspaceId ?? '');
  const enableBot = useEnableBot(workspaceId ?? '');
  const disableBot = useDisableBot(workspaceId ?? '');
  const archiveConversations = useArchiveConversations(workspaceId ?? '');
  const unarchiveConversations = useUnarchiveConversations(workspaceId ?? '');

  const openAssignmentSheet = useCallback((conversation: ConversationListItem) => {
    setAssigningConversation(conversation);
    assignmentSheetRef.current?.expand();
  }, []);

  function handleAssign(userId: string | null) {
    if (!assigningConversation?.contactId) return;
    assignMutation.mutate({ contactIds: [assigningConversation.contactId], assignedId: userId });
  }

  function handleToggleRead(conversation: ConversationListItem) {
    if (isUnread(conversation)) {
      markRead.mutate(conversation.id);
    } else {
      markUnread.mutate(conversation.id);
    }
  }

  function handleToggleBot(conversation: ConversationListItem) {
    if (isBotActive(conversation.botEnabled, conversation.botResumeAt)) {
      disableBot.mutate([conversation.id]);
    } else {
      enableBot.mutate([conversation.id]);
    }
  }

  function handleArchive(conversation: ConversationListItem) {
    archiveConversations.mutate([conversation.id]);
    showToast({
      message: t('conversations.archive'),
      tone: 'neutral',
      action: {
        label: t('conversations.undo'),
        onPress: () => unarchiveConversations.mutate([conversation.id]),
      },
    });
  }

  const listEmptyComponent = useMemo(() => {
    if (filterCount > 0 || filtersSnapshot.keyword) {
      return (
        <EmptyState
          icon="filter-outline"
          title={t('conversations.emptyFiltered')}
          action={{ label: t('conversations.clearFilters'), onPress: resetFilters }}
        />
      );
    }
    return <EmptyState icon="chatbubbles-outline" title={t('conversations.empty')} />;
  }, [filterCount, filtersSnapshot.keyword, resetFilters, t]);

  const normalizedError = query.error ? normalizeApiError(query.error) : null;
  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} message={normalizedError.message} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { padding: spacing.md, gap: spacing.sm }]}>
        {currentWorkspace ? (
          <WorkspacePill
            name={currentWorkspace.name}
            logo={currentWorkspace.logo}
            onPress={() => workspaceSwitcherSheetRef.current?.expand()}
          />
        ) : null}
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <SearchBar
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t('common.search') ?? undefined}
            />
          </View>
          <IconButton
            accessibilityLabel={t('conversations.filters')}
            icon="filter"
            variant="tonal"
            badgeCount={filterCount}
            onPress={() => filterSheetRef.current?.expand()}
          />
        </View>
      </View>

      <ConnectionBanner state={connectionState} />

      <FilterChipsRow />

      {query.isError ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <ErrorBanner
            message={describeApiError(query.error, t)}
            actionLabel={t('common.retry') ?? undefined}
            onAction={() => query.refetch()}
          />
        </View>
      ) : null}

      {query.isPending ? (
        <View style={{ paddingTop: spacing.sm }}>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <SkeletonRow.Conversation key={index} />
          ))}
        </View>
      ) : (
        <FlashList
          data={conversations}
          keyExtractor={(item) => item.id}
          getItemType={conversationRowItemType}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/(app)/conversations/${item.id}`)}
              onLongPress={() => openAssignmentSheet(item)}
              onToggleRead={() => handleToggleRead(item)}
              onToggleBot={() => handleToggleBot(item)}
              onArchive={() => handleArchive(item)}
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
          ListEmptyComponent={listEmptyComponent}
          ListFooterComponent={<ListFooterSpinner visible={query.isFetchingNextPage} />}
        />
      )}

      <FilterSheet sheetRef={filterSheetRef} />
      {workspaceId ? (
        <AssignmentSheet
          sheetRef={assignmentSheetRef}
          workspaceId={workspaceId}
          onAssign={handleAssign}
        />
      ) : null}
      <WorkspaceSwitcherSheet ref={workspaceSwitcherSheetRef} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
});
