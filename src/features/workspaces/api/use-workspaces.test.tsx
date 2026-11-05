import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { useWorkspaces } from './use-workspaces';

jest.mock('@/api/client', () => ({
  apiClient: { GET: jest.fn() },
}));

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useWorkspaces', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists current membership workspaces from the member-scoped endpoint', async () => {
    jest.mocked(apiClient.GET).mockResolvedValue({
      data: {
        workspaces: [{ id: 'workspace-1', name: 'Support', logo: null, brandColor: '#123456' }],
      },
      error: undefined,
    } as never);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useWorkspaces(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(apiClient.GET).toHaveBeenCalledWith('/v1/me/workspaces');
    expect(result.current.data).toEqual([
      { id: 'workspace-1', name: 'Support', logo: null, brandColor: '#123456' },
    ]);
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });
});
