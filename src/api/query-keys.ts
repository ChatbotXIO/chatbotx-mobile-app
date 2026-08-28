/**
 * Central query-key factory. Every workspace-scoped key starts with `['ws', workspaceId, ...]` so
 * a workspace switch can invalidate/clear everything for the old workspace with one
 * `queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'ws' && query.queryKey[1] === oldWorkspaceId })`
 * call. Session/workspace-list keys are global (not workspace-scoped).
 */
export const queryKeys = {
  session: () => ['session'] as const,
  workspaces: () => ['workspaces'] as const,

  ws: {
    conversations: {
      list: (workspaceId: string, filters: Record<string, unknown>) =>
        ['ws', workspaceId, 'conversations', 'list', filters] as const,
      detail: (workspaceId: string, conversationId: string) =>
        ['ws', workspaceId, 'conversations', 'detail', conversationId] as const,
    },
    messages: {
      list: (workspaceId: string, conversationId: string) =>
        ['ws', workspaceId, 'messages', 'list', conversationId] as const,
    },
    contacts: {
      list: (workspaceId: string, filters: Record<string, unknown>) =>
        ['ws', workspaceId, 'contacts', 'list', filters] as const,
      detail: (workspaceId: string, contactId: string) =>
        ['ws', workspaceId, 'contacts', 'detail', contactId] as const,
    },
    flows: {
      list: (workspaceId: string) => ['ws', workspaceId, 'flows', 'list'] as const,
    },
    sequences: {
      list: (workspaceId: string) => ['ws', workspaceId, 'sequences', 'list'] as const,
    },
    tags: {
      catalog: (workspaceId: string) => ['ws', workspaceId, 'tags', 'catalog'] as const,
    },
    customFields: {
      catalog: (workspaceId: string) => ['ws', workspaceId, 'custom-fields', 'catalog'] as const,
    },
    members: {
      list: (workspaceId: string) => ['ws', workspaceId, 'members', 'list'] as const,
    },
    teams: {
      list: (workspaceId: string) => ['ws', workspaceId, 'teams', 'list'] as const,
    },
    savedReplies: {
      list: (workspaceId: string) => ['ws', workspaceId, 'saved-replies', 'list'] as const,
    },
  },
} as const;

/** Predicate for `queryClient.removeQueries` on workspace switch — clears every `['ws', id, ...]`
 * key for the given workspace. */
export function isWorkspaceQuery(queryKey: readonly unknown[], workspaceId: string): boolean {
  return queryKey[0] === 'ws' && queryKey[1] === workspaceId;
}
