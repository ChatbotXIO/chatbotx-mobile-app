import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { flattenPages } from '@/api/pagination';
import { ConnectionTitle } from '@/components/ui/connection-title';
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
import { ConversationActionsSheet } from '@/features/conversations/components/conversation-actions-sheet';
import {
  ConversationRow,
  conversationRowItemType,
} from '@/features/conversations/components/conversation-row';
import { FilterChipsRow } from '@/features/conversations/components/filter-chips-row';
import { FilterSheet } from '@/features/conversations/components/filter-sheet';
import {
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
import { WorkspaceAvatarButton } from '@/features/workspaces/components/workspace-avatar-button';
import { useWorkspaces } from '@/features/workspaces/api/use-workspaces';
import { ConnectionErrorCard } from '@/realtime/connection-error-card';
import { useReducedMotion } from '@/theme/motion';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

const SEARCH_DEBOUNCE_MS = 350;
const SKELETON_ROW_COUNT = 8;
/** Scroll distance over which the large title shrinks and the header hairline fades in. */
const TITLE_COLLAPSE_DISTANCE = 48;
const COLLAPSED_TITLE_SCALE = 0.62;

/** Count of active filter dimensions (excluding `keyword`, which has its own search bar affordance
 * and doesn't belong in the "how many filters are on" badge) — drives the filter IconButton's
 * `badgeCount`. */
/** Copy for an empty result, specific to the active quick-filter chip. */
function emptyFilteredKey(filters: ReturnType<typeof conversationFiltersSnapshot>): string {
  if (filters.keyword) return 'conversations.emptyFiltered';
  if (filters.status?.includes('unread')) return 'conversations.emptyUnread';
  if (filters.status?.includes('followUp')) return 'conversations.emptyFollowing';
  if (filters.botCategory === 'bot') return 'conversations.emptyBot';
  return 'conversations.emptyFiltered';
}

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
  const reducedMotion = useReducedMotion();
  const scrollY = useSharedValue(0);

  const [searchText, setSearchText] = useState('');
  const setKeyword = useConversationFilters((state) => state.setKeyword);
  const resetFilters = useConversationFilters((state) => state.reset);
  const filtersSnapshot = useConversationFilters(useShallow(conversationFiltersSnapshot));
  const filterCount = activeFilterCount(filtersSnapshot);
  const [assigningConversation, setAssigningConversation] = useState<ConversationListItem | null>(
    null,
  );

  const [actionsConversation, setActionsConversation] = useState<ConversationListItem | null>(null);

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const actionsSheetRef = useRef<BottomSheetModal>(null);
  const assignmentSheetRef = useRef<BottomSheetModal>(null);
  const workspaceSwitcherSheetRef = useRef<BottomSheetModal>(null);
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find((workspace) => workspace.id === workspaceId);

  useEffect(() => {
    const timeout = setTimeout(() => setKeyword(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchText, setKeyword]);

  const query = useConversationsInfinite(workspaceId);
  const conversations = flattenPages(query.data?.pages);
  const assignMutation = useAssignConversations(workspaceId ?? '');
  const markRead = useMarkConversationRead(workspaceId ?? '');
  const markUnread = useMarkConversationUnread(workspaceId ?? '');
  const enableBot = useEnableBot(workspaceId ?? '');
  const disableBot = useDisableBot(workspaceId ?? '');
  const archiveConversations = useArchiveConversations(workspaceId ?? '');
  const unarchiveConversations = useUnarchiveConversations(workspaceId ?? '');

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.set(event.nativeEvent.contentOffset.y);
    },
    [scrollY],
  );
  // Transform/opacity only — no layout-bound animation, so the header never reflows while scrolling.
  const titleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, TITLE_COLLAPSE_DISTANCE],
          [1, COLLAPSED_TITLE_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, TITLE_COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));

  const openAssignmentSheet = useCallback((conversation: ConversationListItem) => {
    setAssigningConversation(conversation);
    assignmentSheetRef.current?.present();
  }, []);

  const openActions = useCallback((conversation: ConversationListItem) => {
    setActionsConversation(conversation);
    actionsSheetRef.current?.present();
  }, []);

  // Same dismiss-then-present chaining as the composer's actions sheet → flow picker.
  const closeActions = useCallback(() => actionsSheetRef.current?.dismiss(), []);

  function handleAssign(userId: string | null) {
    if (!assigningConversation) return;
    assignMutation.mutate({ conversationIds: [assigningConversation.id], assignedId: userId });
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
    if (conversation.archivedAt) {
      unarchiveConversations.mutate([conversation.id]);
      showToast({
        message: t('conversations.archiveUndone'),
        tone: 'neutral',
        action: {
          label: t('conversations.undo'),
          onPress: () => archiveConversations.mutate([conversation.id]),
        },
      });
      return;
    }

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
          icon="list-filter"
          title={t(emptyFilteredKey(filtersSnapshot))}
          action={{ label: t('conversations.clearFilters'), onPress: resetFilters }}
        />
      );
    }
    return <EmptyState icon="messages-square" title={t('conversations.empty')} />;
  }, [filterCount, filtersSnapshot, resetFilters, t]);

  const normalizedError = query.error ? normalizeApiError(query.error) : null;
  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={{ backgroundColor: colors.surface1 }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
        <View style={[styles.titleRow, { gap: spacing.ms }]}>
          {currentWorkspace ? (
            <WorkspaceAvatarButton
              name={currentWorkspace.name}
              logo={currentWorkspace.logo}
              onPress={() => workspaceSwitcherSheetRef.current?.present()}
            />
          ) : null}
          <Animated.View style={[styles.titleSlot, reducedMotion ? undefined : titleStyle]}>
            <ConnectionTitle title={t('conversations.inboxTitle')} variant="display" />
          </Animated.View>
          <IconButton
            accessibilityLabel={t('conversations.filters')}
            icon="list-filter"
            variant="tonal"
            badgeCount={filterCount}
            onPress={() => filterSheetRef.current?.present()}
          />
        </View>
        <SearchBar
          pill
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('common.search') ?? undefined}
        />
      </View>

      <FilterChipsRow />
      <Animated.View
        pointerEvents="none"
        style={[styles.hairline, { backgroundColor: colors.borderSubtle }, hairlineStyle]}
      />

      <ConnectionErrorCard />

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
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/(app)/conversations/${item.id}`)}
              onOpenActions={() => openActions(item)}
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
      <ConversationActionsSheet
        ref={actionsSheetRef}
        conversation={actionsConversation}
        onToggleRead={handleToggleRead}
        onToggleBot={handleToggleBot}
        onArchive={handleArchive}
        onAssign={openAssignmentSheet}
        onClose={closeActions}
      />
      <WorkspaceSwitcherSheet ref={workspaceSwitcherSheetRef} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleSlot: {
    flex: 1,
    // Anchor the shrink at the start edge so the title tucks toward the workspace avatar.
    transformOrigin: 'left center',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
});
