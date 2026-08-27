import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { useSwitchWorkspace } from '@/features/workspaces/api/use-switch-workspace';
import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function seedQueries(queryClient: QueryClient, workspaceId: string) {
  queryClient.setQueryData(['ws', workspaceId, 'conversations', 'list', {}], { pages: [] });
  queryClient.setQueryData(['ws', workspaceId, 'contacts', 'list', {}], { pages: [] });
}

// `renderHook` in this @testing-library/react-native version is async (it awaits an internal
// `render()` call) — every call site must `await` it or `result` resolves to a Promise instead of
// the ref object, and `result.current` throws.
function renderSwitchWorkspace(queryClient: QueryClient) {
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useSwitchWorkspace(), { wrapper });
}

const activeQueryClients: QueryClient[] = [];

/** Tracks every QueryClient created in a test so it can be torn down afterward — a live
 * QueryClient schedules per-query `gcTime` timers (and focus/online listeners via `unmount()`)
 * that otherwise keep the Jest process alive past the test run. */
function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

describe('useSwitchWorkspace', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useWorkspaceStore.setState({ currentWorkspaceId: null });
    useConversationFilters.getState().reset();
  });

  afterEach(() => {
    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop()!;
      queryClient.clear();
      queryClient.unmount();
    }
  });

  it('removes cached queries for the previous workspace only', async () => {
    const queryClient = createTestQueryClient();
    seedQueries(queryClient, 'ws-old');
    seedQueries(queryClient, 'ws-new');
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });

    const { result } = await renderSwitchWorkspace(queryClient);
    act(() => {
      result.current('ws-new', { navigate: true });
    });

    expect(queryClient.getQueryData(['ws', 'ws-old', 'conversations', 'list', {}])).toBeUndefined();
    expect(queryClient.getQueryData(['ws', 'ws-new', 'conversations', 'list', {}])).toBeDefined();
  });

  it('sets the new workspace id and navigates to conversations when opts.navigate is true', async () => {
    const queryClient = createTestQueryClient();
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });

    const { result } = await renderSwitchWorkspace(queryClient);
    act(() => {
      result.current('ws-new', { navigate: true });
    });

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-new');
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/conversations');
  });

  it('does not navigate when opts.navigate is omitted for a non-null workspace', async () => {
    const queryClient = createTestQueryClient();
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });

    const { result } = await renderSwitchWorkspace(queryClient);
    act(() => {
      result.current('ws-new');
    });

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-new');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to the workspace picker and clears the workspace id when next is null', async () => {
    const queryClient = createTestQueryClient();
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });

    const { result } = await renderSwitchWorkspace(queryClient);
    act(() => {
      result.current(null);
    });

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/workspace-picker');
  });

  it('resets the conversation filters store on switch', async () => {
    const queryClient = createTestQueryClient();
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-old' });
    useConversationFilters.getState().setKeyword('hello');
    useConversationFilters.getState().setAssignedId('user-1');

    const { result } = await renderSwitchWorkspace(queryClient);
    act(() => {
      result.current('ws-new');
    });

    expect(useConversationFilters.getState().keyword).toBe('');
    expect(useConversationFilters.getState().assignedId).toBeUndefined();
  });
});
