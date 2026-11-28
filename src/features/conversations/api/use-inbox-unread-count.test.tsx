import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { useInboxUnreadCount } from './use-inbox-unread-count';

const WORKSPACE_ID = 'ws-1';

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    botEnabled: true,
    botResumeAt: null,
    archivedAt: null,
    additionalAttributes: null,
    contactLastReadAt: null,
    agentLastReadAt: null,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    followed: false,
    workspaceId: WORKSPACE_ID,
    contactId: 'contact-1',
    sourceId: null,
    lastStep: null,
    currentStep: null,
    adminRepliedAt: null,
    contactRepliedAt: null,
    contactInboxes: [],
    messages: [],
    contact: null,
    assignedUser: null,
    assignedInboxTeam: null,
    ...overrides,
  } as unknown as ConversationListItem;
}

function unreadConversation(id: string): ConversationListItem {
  return fakeConversation({
    id,
    lastActivityAt: '2026-01-02T00:00:00.000Z',
    agentLastReadAt: '2026-01-01T00:00:00.000Z',
  });
}

function readConversation(id: string): ConversationListItem {
  return fakeConversation({
    id,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    agentLastReadAt: '2026-01-02T00:00:00.000Z',
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

describe('useInboxUnreadCount', () => {
  it('returns 0 when nothing is cached', async () => {
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useInboxUnreadCount(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    });
    expect(result.current).toBe(0);
  });

  it('counts unread conversations across a single cached list page', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', WORKSPACE_ID, 'conversations', 'list', {}], {
      pages: [
        {
          data: [unreadConversation('a'), readConversation('b'), unreadConversation('c')],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    });

    const { result } = await renderHook(() => useInboxUnreadCount(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    });
    expect(result.current).toBe(2);
  });

  it('deduplicates conversations cached under multiple filter combinations', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', WORKSPACE_ID, 'conversations', 'list', { keyword: '' }], {
      pages: [{ data: [unreadConversation('a')], nextCursor: null }],
      pageParams: [undefined],
    });
    queryClient.setQueryData(
      ['ws', WORKSPACE_ID, 'conversations', 'list', { status: ['unread'] }],
      {
        pages: [{ data: [unreadConversation('a')], nextCursor: null }],
        pageParams: [undefined],
      },
    );

    const { result } = await renderHook(() => useInboxUnreadCount(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    });
    expect(result.current).toBe(1);
  });

  it('ignores conversations cached under a different workspace', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', 'other-ws', 'conversations', 'list', {}], {
      pages: [{ data: [unreadConversation('a')], nextCursor: null }],
      pageParams: [undefined],
    });

    const { result } = await renderHook(() => useInboxUnreadCount(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    });
    expect(result.current).toBe(0);
  });

  it('recomputes when the cache changes', async () => {
    const queryClient = createTestQueryClient();
    const key = ['ws', WORKSPACE_ID, 'conversations', 'list', {}];
    queryClient.setQueryData(key, {
      pages: [{ data: [readConversation('a')], nextCursor: null }],
      pageParams: [undefined],
    });

    const { result } = await renderHook(() => useInboxUnreadCount(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    });
    expect(result.current).toBe(0);

    await act(async () => {
      queryClient.setQueryData(key, {
        pages: [{ data: [unreadConversation('a')], nextCursor: null }],
        pageParams: [undefined],
      });
    });

    await waitFor(() => expect(result.current).toBe(1));
  });

  it('does not re-render for unrelated cache writes', async () => {
    const queryClient = createTestQueryClient();
    let renders = 0;
    await renderHook(
      () => {
        renders += 1;
        return useInboxUnreadCount(WORKSPACE_ID);
      },
      { wrapper: wrapper(queryClient) },
    );
    const rendersBefore = renders;

    await act(async () => {
      queryClient.setQueryData(['workspaces'], [{ id: 'x' }]);
      queryClient.setQueryData(['ws', 'other-ws', 'conversations', 'list', {}], {
        pages: [{ data: [unreadConversation('z')], nextCursor: null }],
        pageParams: [undefined],
      });
      await Promise.resolve();
    });

    expect(renders).toBe(rendersBefore);
  });

  it('coalesces several list writes in one tick into a single update', async () => {
    const queryClient = createTestQueryClient();
    let renders = 0;
    const { result } = await renderHook(
      () => {
        renders += 1;
        return useInboxUnreadCount(WORKSPACE_ID);
      },
      { wrapper: wrapper(queryClient) },
    );
    const rendersBefore = renders;

    await act(async () => {
      for (const id of ['a', 'b', 'c']) {
        queryClient.setQueryData(['ws', WORKSPACE_ID, 'conversations', 'list', { id }], {
          pages: [{ data: [unreadConversation(id)], nextCursor: null }],
          pageParams: [undefined],
        });
      }
    });

    await waitFor(() => expect(result.current).toBe(3));
    expect(renders - rendersBefore).toBe(1);
  });

  it('returns 0 for a null workspaceId', async () => {
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useInboxUnreadCount(null), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current).toBe(0));
  });
});
