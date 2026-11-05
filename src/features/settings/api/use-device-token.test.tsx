import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { getPushTokenAsync } from '@/lib/notifications';
import { useRegisterDeviceToken, useUnregisterDeviceToken } from './use-device-token';

jest.mock('expo-notifications', () => ({
  addPushTokenListener: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('@/api/client', () => ({
  apiClient: { DELETE: jest.fn(), PUT: jest.fn() },
}));
jest.mock('@/lib/notifications', () => ({
  getPushTokenAsync: jest.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity },
    },
  });
}

describe('device-token mutations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers the token on the selected workspace without leaking workspaceId into the body', async () => {
    jest.mocked(getPushTokenAsync).mockResolvedValue({
      status: 'granted',
      token: 'ExponentPushToken[1]',
    });
    jest.mocked(apiClient.PUT).mockResolvedValue({ data: undefined, error: undefined } as never);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useRegisterDeviceToken('workspace-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiClient.PUT).toHaveBeenCalledWith('/v1/me/device-tokens', {
      body: { platform: 'ios', token: 'ExponentPushToken[1]' },
    });
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });

  it('unregisters the cached token through the member-scoped endpoint', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('ExponentPushToken[1]');
    jest.mocked(apiClient.DELETE).mockResolvedValue({ data: undefined, error: undefined } as never);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useUnregisterDeviceToken(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiClient.DELETE).toHaveBeenCalledWith('/v1/me/device-tokens', {
      body: { token: 'ExponentPushToken[1]' },
    });
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });
});
