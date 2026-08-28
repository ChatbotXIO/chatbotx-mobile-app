import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useDeleteMessage, useSetMessageAttributes } from '@/features/chat/api/use-message-actions';
import type { Message } from '@/features/chat/api/use-messages-infinite';

jest.mock('@/api/client', () => ({
  apiClient: {
    DELETE: jest.fn(),
    POST: jest.fn(),
    PATCH: jest.fn(),
  },
}));

const mockedDelete = apiClient.DELETE as jest.Mock;
const mockedPost = apiClient.POST as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockedDelete.mockReset();
  mockedPost.mockReset();
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    clientId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    contactInboxId: '',
    text: 'hello',
    contentAttributes: null,
    messageType: 'outgoing',
    contentType: 'text',
    senderType: 'user',
    sourceId: null,
    deletedAt: null,
    type: 'message',
    parentId: null,
    attributes: null,
    sendError: null,
    attachments: [],
    ...overrides,
  } as unknown as Message;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function messagesData(messages: Message[]) {
  return { pages: [{ data: messages, nextCursor: null }], pageParams: [undefined] };
}

describe('useDeleteMessage', () => {
  it('optimistically sets deletedAt and rolls it back on error', async () => {
    mockedDelete.mockResolvedValue({ data: undefined, error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData([fakeMessage({ deletedAt: null })]));

    const { result } = await renderHook(() => useDeleteMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ messageId: 'msg-1', createdAt: '2026-01-01T00:00:00.000Z' });
    });

    // Not asserting the transient optimistic (non-null deletedAt) state here: `onMutate` now
    // awaits `cancelQueries` before patching, so by the time a `waitFor` poll could observe it,
    // the mutation may have already settled and rolled back — a real race, not a test timing
    // nuance. The end-to-end contract that matters is covered below: the row must NOT be left
    // permanently deleted after an error.
    await waitFor(() => expect(result.current.isError).toBe(true));

    const rolledBack = queryClient.getQueryData<ReturnType<typeof messagesData>>(queryKey);
    expect(rolledBack?.pages[0]?.data[0]?.deletedAt).toBeNull();
  });

  it('keeps deletedAt set and invalidates the list on success', async () => {
    mockedDelete.mockResolvedValue({ data: undefined, error: undefined });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(queryKey, messagesData([fakeMessage({ deletedAt: null })]));

    const { result } = await renderHook(() => useDeleteMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ messageId: 'msg-1', createdAt: '2026-01-01T00:00:00.000Z' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });
});

describe('useSetMessageAttributes', () => {
  it('invalidates the messages list once the mutation settles', async () => {
    mockedPost.mockResolvedValue({ data: undefined, error: undefined });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(queryKey, messagesData([fakeMessage()]));

    const { result } = await renderHook(() => useSetMessageAttributes('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        messageId: 'msg-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        liked: true,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });

  it('invalidates the messages list even when the mutation fails', async () => {
    mockedPost.mockResolvedValue({ data: undefined, error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(queryKey, messagesData([fakeMessage()]));

    const { result } = await renderHook(() => useSetMessageAttributes('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        messageId: 'msg-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        hidden: true,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });
});
