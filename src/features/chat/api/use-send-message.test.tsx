import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { createOptimisticMessage, useSendMessage } from '@/features/chat/api/use-send-message';

jest.mock('@/api/client', () => ({
  apiClient: {
    POST: jest.fn(),
  },
}));

const mockedPost = apiClient.POST as jest.Mock;

const BASE = {
  clientId: '1712345678000123',
  conversationId: 'conv-1',
  workspaceId: 'ws-1',
};

describe('createOptimisticMessage', () => {
  it('always sets attachments to an array', () => {
    // Regression: the optimistic entry previously omitted `attachments` entirely, and
    // message-bubble.tsx crashed with "Cannot read property 'length' of undefined" on EVERY send.
    const message = createOptimisticMessage({ ...BASE, text: 'hello' });

    expect(Array.isArray(message.attachments)).toBe(true);
    expect(message.attachments).toHaveLength(0);
  });

  it('populates the fields the message bubble renders from', () => {
    const message = createOptimisticMessage({ ...BASE, text: 'hello' });

    // senderType must not be 'contact', or the bubble renders on the inbound (left) side.
    expect(message.senderType).toBe('user');
    expect(message.messageType).toBe('outgoing');
    expect(message.contentType).toBe('text');
    expect(message.id).toBe(`optimistic-${BASE.clientId}`);
    expect(message.clientId).toBe(BASE.clientId);
    expect(message.conversationId).toBe(BASE.conversationId);
    expect(typeof message.createdAt).toBe('string');
  });

  it('maps text to null when omitted and passes it through otherwise', () => {
    expect(createOptimisticMessage(BASE).text).toBeNull();
    expect(createOptimisticMessage({ ...BASE, text: 'hi' }).text).toBe('hi');
  });

  it('renders a picked image as a local-URI image attachment', () => {
    const message = createOptimisticMessage({
      ...BASE,
      attachments: [
        { uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg', fileName: 'photo.jpg' },
      ],
    });

    expect(message.attachments).toHaveLength(1);
    const [attachment] = message.attachments;
    expect(attachment.fileType).toBe('image');
    // AttachmentView renders the image from `url`; the local file:// URI drives the preview.
    expect(attachment.url).toBe('file:///tmp/photo.jpg');
    expect(attachment.mimeType).toBe('image/jpeg');
    expect(attachment.name).toBe('photo.jpg');
  });

  it('gives each attachment a distinct id', () => {
    // AttachmentView keys on `id` — duplicates would collide as React keys.
    const message = createOptimisticMessage({
      ...BASE,
      attachments: [
        { uri: 'file:///tmp/a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' },
        { uri: 'file:///tmp/b.jpg', mimeType: 'image/jpeg', fileName: 'b.jpg' },
      ],
    });

    const ids = message.attachments.map((attachment) => attachment.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('treats a non-image mime type as a file, not an image', () => {
    // Otherwise AttachmentView's image branch would try to render a PDF as a broken image.
    const message = createOptimisticMessage({
      ...BASE,
      attachments: [
        { uri: 'file:///tmp/doc.pdf', mimeType: 'application/pdf', fileName: 'doc.pdf' },
      ],
    });

    expect(message.attachments[0].fileType).toBe('file');
  });

  it('carries a replyTo messageId through as parentId', () => {
    const message = createOptimisticMessage({ ...BASE, text: 'hi', parentId: 'parent-msg-1' });

    expect(message.parentId).toBe('parent-msg-1');
  });

  it('defaults parentId to null when no reply is set', () => {
    const message = createOptimisticMessage({ ...BASE, text: 'hi' });

    expect(message.parentId).toBeNull();
  });
});

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function messagesData(): { pages: { data: unknown[]; nextCursor: null }[]; pageParams: unknown[] } {
  return { pages: [{ data: [], nextCursor: null }], pageParams: [undefined] };
}

describe('useSendMessage', () => {
  afterEach(() => {
    mockedPost.mockReset();
    useChatStore.setState({
      draftsByConversation: {},
      composerModeByConversation: {},
      uploadProgressByClientId: {},
    });
    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop()!;
      queryClient.clear();
      queryClient.unmount();
    }
  });

  it('skips the optimistic insert entirely for a flowId send', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'server-1' }, error: undefined });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData());

    const { result } = await renderHook(() => useSendMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        flowId: 'flow-1',
        nodeId: 'node-1',
      });
    });

    // Assert synchronously right after onMutate would have run — no optimistic entry appears at
    // any point, not just after settling.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = queryClient.getQueryData<ReturnType<typeof messagesData>>(queryKey);
    expect(data?.pages[0]?.data).toHaveLength(0);
    expect(mockedPost).toHaveBeenCalledWith(
      '/workspaces/{workspaceId}/conversations/{conversationId}/messages',
      expect.objectContaining({
        body: expect.objectContaining({ flowId: 'flow-1', nodeId: 'node-1' }),
      }),
    );
  });

  it('populates replyToMessageId/replyToMessageCreatedAt in the request body and parentId on the optimistic entry', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'server-1' }, error: undefined });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData());

    const { result } = await renderHook(() => useSendMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        text: 'a reply',
        replyTo: { messageId: 'parent-1', createdAt: '2026-01-01T00:00:00.000Z' },
      });
    });

    // `onMutate` awaits `cancelQueries` before patching, so the optimistic entry lands a
    // microtask after `mutate()` returns rather than perfectly synchronously — wait for it.
    await waitFor(() => {
      const data = queryClient.getQueryData<{
        pages: { data: { parentId: string | null }[] }[];
      }>(queryKey);
      expect(data?.pages[0]?.data[0]?.parentId).toBe('parent-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedPost).toHaveBeenCalledWith(
      '/workspaces/{workspaceId}/conversations/{conversationId}/messages',
      expect.objectContaining({
        body: expect.objectContaining({
          replyToMessageId: 'parent-1',
          replyToMessageCreatedAt: '2026-01-01T00:00:00.000Z',
        }),
      }),
    );
  });

  it('removes the optimistic bubble and restores the draft on a workspaceBlocked rejection', async () => {
    mockedPost.mockResolvedValue({
      data: undefined,
      error: { code: 'workspaceBlocked', status: 402, message: 'blocked' },
    });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData());

    const { result } = await renderHook(() => useSendMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', conversationId: 'conv-1', text: 'hello' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const data = queryClient.getQueryData<ReturnType<typeof messagesData>>(queryKey);
    expect(data?.pages[0]?.data).toHaveLength(0);
    expect(useChatStore.getState().draftsByConversation['conv-1']).toBe('hello');
  });

  it('keeps a failed bubble (does not remove it) on a non-terminal error', async () => {
    mockedPost.mockResolvedValue({
      data: undefined,
      error: { code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'boom' },
    });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData());

    const { result } = await renderHook(() => useSendMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', conversationId: 'conv-1', text: 'hello' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const data = queryClient.getQueryData<{
      pages: { data: { __optimisticStatus?: string }[] }[];
    }>(queryKey);
    expect(data?.pages[0]?.data).toHaveLength(1);
    expect(data?.pages[0]?.data[0]?.__optimisticStatus).toBe('failed');
    expect(useChatStore.getState().draftsByConversation['conv-1']).toBeUndefined();
  });

  it('sends the same clientId in the request body as the cached optimistic row', async () => {
    // Regression: `mutationFn` and `onMutate` used to each call `generateClientId()`
    // independently, so the optimistic bubble and the outgoing request carried different ids —
    // producing a duplicate bubble until refetch and an orphaned upload-progress entry.
    mockedPost.mockResolvedValue({ data: { id: 'server-1' }, error: undefined });
    const queryClient = createTestQueryClient();
    const queryKey = queryKeys.ws.messages.list('ws-1', 'conv-1');
    queryClient.setQueryData(queryKey, messagesData());

    const { result } = await renderHook(() => useSendMessage('ws-1', 'conv-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', conversationId: 'conv-1', text: 'hello' });
    });

    // `onMutate` awaits `cancelQueries` before patching, so the optimistic entry lands a
    // microtask after `mutate()` returns rather than perfectly synchronously — wait for it.
    let cachedClientId: string | undefined;
    await waitFor(() => {
      const data = queryClient.getQueryData<{ pages: { data: { clientId?: string }[] }[] }>(
        queryKey,
      );
      cachedClientId = data?.pages[0]?.data[0]?.clientId;
      expect(cachedClientId).toEqual(expect.any(String));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedPost).toHaveBeenCalledWith(
      '/workspaces/{workspaceId}/conversations/{conversationId}/messages',
      expect.objectContaining({ body: expect.objectContaining({ clientId: cachedClientId }) }),
    );
  });
});
