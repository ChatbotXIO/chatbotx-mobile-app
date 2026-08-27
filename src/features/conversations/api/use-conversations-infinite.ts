import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { flattenPages, getNextPageParam } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';
import {
  conversationFiltersSnapshot,
  useConversationFilters,
} from '@/features/conversations/stores/use-conversation-filters';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useAuthStore } from '@/stores/use-auth-store';

/**
 * Request/response types derived directly from the generated schema's `operations` map, so they
 * always match `conversationsAPI.listConversationsByPOSTAuthenticatedAPI` exactly (verified by
 * reading src/api/generated/schema.ts — do not hand-declare these, the operation gets regenerated
 * whenever `pnpm generate:api` reruns). The response shape matches api/pagination.ts's
 * `CursorPage<T>` (`{ data, nextCursor, prevCursor }`), so this hook uses the shared helpers.
 */
type ListConversationsOperation =
  operations['conversationsAPI.listConversationsByPOSTAuthenticatedAPI'];
export type ListConversationsResponse =
  ListConversationsOperation['responses'][200]['content']['application/json'];
export type ConversationListItem = ListConversationsResponse['data'][number];

const PER_PAGE = 30;

/**
 * `onlyAssignedContacts` (Phase 6's usePermissions) forces `assignedId` to the current user's own
 * id, overriding any manual "assigned to" filter — a restricted member must not be able to browse
 * other agents' conversations by picking a different filter value. Unrestricted members keep
 * whatever the filter store holds (including "unassigned"/other-user values).
 */
export function useConversationsInfinite(workspaceId: string | null) {
  // `conversationFiltersSnapshot` builds a fresh object per call, and zustand v5's
  // useSyncExternalStore compares selector results with Object.is (no shallow fallback,
  // unlike v4) — without useShallow this re-renders on every render and infinite-loops.
  const filters = useConversationFilters(useShallow(conversationFiltersSnapshot));
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { onlyAssignedContacts, isLoading: isPermissionsLoading } = usePermissions(workspaceId);
  const effectiveAssignedId = onlyAssignedContacts
    ? (currentUserId ?? filters.assignedId)
    : filters.assignedId;
  const effectiveFilters = useMemo(
    () => ({ ...filters, assignedId: effectiveAssignedId }),
    [filters, effectiveAssignedId],
  );

  return useInfiniteQuery({
    queryKey: queryKeys.ws.conversations.list(workspaceId ?? '', effectiveFilters),
    // Waits for permissions to settle before firing the first fetch — `usePermissions` fails
    // CLOSED (onlyAssignedContacts: true) while loading, but that fail-closed default would
    // otherwise still be baked into this query's very first request/cache-key if it ran before
    // the real permission bits were known, letting a restricted member's first page briefly use
    // the wrong scope (or an unrestricted member's first page be needlessly scoped down).
    enabled: workspaceId !== null && !isPermissionsLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListConversationsResponse> => {
      const { data, error } = await apiClient.POST('/workspaces/{workspaceId}/conversations/list', {
        params: { path: { workspaceId: workspaceId! } },
        body: {
          botCategory: effectiveFilters.botCategory,
          assignedId: effectiveFilters.assignedId,
          channel: effectiveFilters.channel,
          status: effectiveFilters.status,
          keyword: effectiveFilters.keyword || undefined,
          botEnabled: effectiveFilters.botEnabled,
          cursor: pageParam,
          perPage: PER_PAGE,
        },
      });
      if (error) {
        throw new ApiError(error);
      }
      return data;
    },
    getNextPageParam,
  });
}

export function flattenConversationPages(
  pages: ListConversationsResponse[] | undefined,
): ConversationListItem[] {
  return flattenPages(pages);
}
