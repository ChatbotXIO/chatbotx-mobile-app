import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import {
  useDisableBot,
  useMarkConversationRead,
} from '@/features/conversations/api/use-conversation-actions';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

jest.mock('@/api/client', () => ({
  apiClient: {
    POST: jest.fn(),
  },
}));

const mockedPost = apiClient.POST as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockedPost.mockReset();
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

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
    workspaceId: 'ws-1',
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

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('patchConversationDetail (via useMarkConversationRead)', () => {
  it('optimistically patches a cached conversation-detail query alongside the list cache', async () => {
    mockedPost.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.conversations.detail('ws-1', 'conv-1');
    queryClient.setQueryData(detailKey, fakeConversation({ agentLastReadAt: null }));
    queryClient.setQueryData(['ws', 'ws-1', 'conversations', 'list', {}], {
      pages: [{ data: [fakeConversation({ agentLastReadAt: null })], nextCursor: null }],
      pageParams: [undefined],
    });

    const { result } = await renderHook(() => useMarkConversationRead('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ConversationListItem>(detailKey);
      expect(detail?.agentLastReadAt).not.toBeNull();
    });
  });

  it('leaves the detail cache untouched when nothing is cached for that conversation', async () => {
    mockedPost.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.conversations.detail('ws-1', 'conv-1');

    const { result } = await renderHook(() => useMarkConversationRead('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(detailKey)).toBeUndefined();
  });
});

describe('useDisableBot', () => {
  it('invalidates the detail query for each disabled conversation on success', async () => {
    mockedPost.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const detailKey = queryKeys.ws.conversations.detail('ws-1', 'conv-1');
    queryClient.setQueryData(detailKey, fakeConversation());

    const { result } = await renderHook(() => useDisableBot('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(['conv-1']);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: detailKey });
  });

  it('rolls back the optimistic botEnabled patch on error', async () => {
    mockedPost.mockResolvedValue({ data: undefined, error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.conversations.detail('ws-1', 'conv-1');
    queryClient.setQueryData(detailKey, fakeConversation({ botEnabled: true }));

    const { result } = await renderHook(() => useDisableBot('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(['conv-1']);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<ConversationListItem>(detailKey)?.botEnabled).toBe(true);
  });
});
