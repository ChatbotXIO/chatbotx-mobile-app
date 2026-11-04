import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { useFlows } from './use-flows';

jest.mock('@/api/client', () => ({
  apiClient: { GET: jest.fn() },
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFlows', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('asks the server for active inbox-enabled flows on every page', async () => {
    jest.mocked(apiClient.GET).mockResolvedValue({
      data: { data: [], pageCount: 1 },
      error: undefined,
    } as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });

    const { result, unmount } = await renderHook(() => useFlows('workspace-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.GET).toHaveBeenCalledWith('/v1/flows', {
      params: { query: { active: true, enableInInbox: true, page: 1, perPage: 50 } },
    });
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });
});
