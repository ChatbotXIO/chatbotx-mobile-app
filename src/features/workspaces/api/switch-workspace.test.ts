import { QueryClient } from '@tanstack/react-query';

import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { applyWorkspaceSwitch } from '@/features/workspaces/api/switch-workspace';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

function seedQueries(queryClient: QueryClient, workspaceId: string) {
  queryClient.setQueryData(['ws', workspaceId, 'conversations', 'list', {}], { pages: [] });
  queryClient.setQueryData(['ws', workspaceId, 'contacts', 'list', {}], { pages: [] });
}

describe('applyWorkspaceSwitch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    useWorkspaceStore.setState({ currentWorkspaceId: null });
    useConversationFilters.getState().reset();
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.unmount();
  });

  it('removes only the old workspace queries, resets filters and sets the new id', () => {
    seedQueries(queryClient, 'ws-old');
    seedQueries(queryClient, 'ws-new');
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });
    useConversationFilters.getState().setAssignedId('user-1');

    applyWorkspaceSwitch(queryClient, 'ws-new');

    expect(queryClient.getQueryData(['ws', 'ws-old', 'conversations', 'list', {}])).toBeUndefined();
    expect(queryClient.getQueryData(['ws', 'ws-new', 'conversations', 'list', {}])).toBeDefined();
    expect(useConversationFilters.getState().assignedId).toBeUndefined();
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-new');
  });

  it('is a no-op when switching to the current workspace', () => {
    seedQueries(queryClient, 'ws-a');
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-a' });
    useConversationFilters.getState().setAssignedId('user-1');

    applyWorkspaceSwitch(queryClient, 'ws-a');

    expect(queryClient.getQueryData(['ws', 'ws-a', 'conversations', 'list', {}])).toBeDefined();
    expect(useConversationFilters.getState().assignedId).toBe('user-1');
  });

  it('only sets the id when there is no current workspace', () => {
    expect(() => applyWorkspaceSwitch(queryClient, 'ws-new')).not.toThrow();
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-new');
  });
});
