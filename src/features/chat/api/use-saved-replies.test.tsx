import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';

import { useSavedReplies } from './use-saved-replies';

jest.mock('@/api/client', () => ({
  apiClient: {
    GET: jest.fn(),
  },
}));

const mockedGet = apiClient.GET as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockedGet.mockReset();
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSavedReplies', () => {
  it('fetches the flat saved-replies list for the workspace', async () => {
    const replies = [{ id: 'r1', shortcut: '/hi', text: 'Hello there' }];
    mockedGet.mockResolvedValue({ data: { data: replies }, error: undefined });

    const { result } = await renderHook(() => useSavedReplies('ws-1'), {
      wrapper: wrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(replies);
    expect(mockedGet).toHaveBeenCalledWith(
      '/workspaces/{workspaceId}/saved-replies',
      expect.objectContaining({ params: { path: { workspaceId: 'ws-1' } } }),
    );
  });

  it('surfaces an error when the request fails', async () => {
    mockedGet.mockResolvedValue({ data: undefined, error: { message: 'boom' } });

    const { result } = await renderHook(() => useSavedReplies('ws-1'), {
      wrapper: wrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
