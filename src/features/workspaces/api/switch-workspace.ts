import type { QueryClient } from '@tanstack/react-query';

import { isWorkspaceQuery } from '@/api/query-keys';
import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/**
 * Hook-free workspace switch cleanup shared by the in-app switcher and the notification-tap
 * handler: drops every cached query of the OLD workspace, resets conversation filters (a stale
 * "assigned to me" id is meaningless in another workspace), then selects the new workspace.
 * Switching to the already-current workspace is a no-op so it never wipes a live cache.
 */
export function applyWorkspaceSwitch(queryClient: QueryClient, next: string | null): void {
  const current = useWorkspaceStore.getState().currentWorkspaceId;
  if (current === next) return;

  if (current) {
    queryClient.removeQueries({ predicate: (query) => isWorkspaceQuery(query.queryKey, current) });
  }
  useConversationFilters.getState().reset();
  useWorkspaceStore.getState().setCurrentWorkspaceId(next);
}
