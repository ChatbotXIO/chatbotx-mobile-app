import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { initNotificationTapHandling } from '@/lib/notification-tap';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

const mockPush = jest.fn();
let mockListener: ((response: unknown) => void) | undefined;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: unknown) => void) => {
    mockListener = listener;
    return { remove: jest.fn() };
  }),
}));

function tap(data: Record<string, string>) {
  mockListener?.({ notification: { request: { content: { data } } } });
}

describe('notification tap handling', () => {
  let dispose: () => void;

  beforeEach(() => {
    mockPush.mockClear();
    queryClient.clear();
    useAuthStore.setState({ status: 'signed-in' });
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws-a' });
    useConversationFilters.getState().reset();
    queryClient.setQueryData(['ws', 'ws-a', 'conversations', 'list', {}], { pages: [] });
    dispose = initNotificationTapHandling();
  });

  afterEach(() => {
    dispose();
    queryClient.clear();
  });

  it('switches workspace with full cleanup when tapped from another workspace', () => {
    useConversationFilters.getState().setAssignedId('user-1');

    tap({ workspaceId: 'ws-b', conversationId: 'c1' });

    expect(queryClient.getQueryData(['ws', 'ws-a', 'conversations', 'list', {}])).toBeUndefined();
    expect(useConversationFilters.getState().assignedId).toBeUndefined();
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-b');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/conversations/[conversationId]',
      params: { conversationId: 'c1' },
    });
  });

  it('keeps the cache when tapped from the same workspace', () => {
    tap({ workspaceId: 'ws-a', conversationId: 'c1' });

    expect(queryClient.getQueryData(['ws', 'ws-a', 'conversations', 'list', {}])).toBeDefined();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a conversationId', () => {
    tap({ workspaceId: 'ws-b' });

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-a');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does nothing when not signed in', () => {
    useAuthStore.setState({ status: 'signed-out' });

    tap({ workspaceId: 'ws-b', conversationId: 'c1' });

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-a');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
