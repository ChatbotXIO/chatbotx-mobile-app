import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { useAuthStore } from '@/stores/use-auth-store';
import { useEnsureDefaultWorkspace } from './use-ensure-default-workspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { name: string }) => `${key}:${vars?.name ?? ''}`,
  }),
}));

jest.mock('@/api/client', () => ({
  apiClient: { POST: jest.fn() },
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEnsureDefaultWorkspace', () => {
  beforeEach(() => {
    useAuthStore.getState().setSignedIn({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane',
      mustChangePassword: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('posts a default name and invalidates the workspace list', async () => {
    const workspace = { id: 'ws-1', name: "Jane's workspace", logo: null, brandColor: '#123456' };
    jest
      .mocked(apiClient.POST)
      .mockResolvedValue({ data: { workspace }, error: undefined } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useEnsureDefaultWorkspace(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiClient.POST).toHaveBeenCalledWith('/v1/me/workspaces/default', {
      body: { name: 'workspaces.defaultName:Jane' },
    });
    await waitFor(() => expect(result.current.data).toEqual(workspace));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.workspaces() });
  });

  it('resolves to null when the backend declines to create one', async () => {
    jest
      .mocked(apiClient.POST)
      .mockResolvedValue({ data: { workspace: null }, error: undefined } as never);
    const queryClient = new QueryClient();

    const { result } = await renderHook(() => useEnsureDefaultWorkspace(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it('throws ApiError on an error response', async () => {
    jest.mocked(apiClient.POST).mockResolvedValue({
      data: undefined,
      error: { code: 'systemError', status: 400, message: 'boom', defined: true },
    } as never);
    const queryClient = new QueryClient();

    const { result } = await renderHook(() => useEnsureDefaultWorkspace(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBeInstanceOf(ApiError);
    });
  });
});
