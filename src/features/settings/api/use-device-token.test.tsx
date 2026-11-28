import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { getPushTokenAsync } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import {
  PushPermissionError,
  usePushTokenRotation,
  useRegisterDeviceToken,
  useUnregisterDeviceToken,
} from './use-device-token';

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
    (apiClient.PUT as jest.Mock).mockResolvedValue({ data: undefined, error: undefined } as never);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useRegisterDeviceToken(), {
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

  it('rejects with PushPermissionError when the OS permission is denied', async () => {
    jest.mocked(getPushTokenAsync).mockResolvedValue({ status: 'denied' } as never);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useRegisterDeviceToken(), {
      wrapper: createWrapper(queryClient),
    });

    let caught: unknown;
    await act(async () => {
      caught = await result.current.mutateAsync().catch((error: unknown) => error);
    });

    expect(caught).toBeInstanceOf(PushPermissionError);
    expect(apiClient.PUT).not.toHaveBeenCalled();
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });

  it('unregisters the cached token through the member-scoped endpoint', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('ExponentPushToken[1]');
    (apiClient.DELETE as jest.Mock).mockResolvedValue({
      data: undefined,
      error: undefined,
    } as never);
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

describe('usePushTokenRotation', () => {
  const remove = jest.fn();
  let rotationListener: () => void;

  beforeEach(() => {
    jest.mocked(Notifications.addPushTokenListener).mockImplementation(((cb: () => void) => {
      rotationListener = cb;
      return { remove };
    }) as never);
    (apiClient.PUT as jest.Mock).mockResolvedValue({ data: undefined, error: undefined } as never);
    (apiClient.DELETE as jest.Mock).mockResolvedValue({
      data: undefined,
      error: undefined,
    } as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('syncs the Expo token on entry without requesting permission', async () => {
    jest
      .mocked(getPushTokenAsync)
      .mockResolvedValue({ status: 'granted', token: 'ExponentPushToken[1]' });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    await renderHook(() => usePushTokenRotation('workspace-1', true));
    await act(async () => {});

    expect(getPushTokenAsync).toHaveBeenCalledWith({ requestPermission: false });
    expect(apiClient.PUT).toHaveBeenCalledWith('/v1/me/device-tokens', {
      body: { platform: 'ios', token: 'ExponentPushToken[1]' },
    });
  });

  it('re-fetches the Expo token on rotation and unregisters the stale one', async () => {
    jest
      .mocked(getPushTokenAsync)
      .mockResolvedValue({ status: 'granted', token: 'ExponentPushToken[2]' });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('ExponentPushToken[1]');

    await renderHook(() => usePushTokenRotation('workspace-1', true));
    await act(async () => {});
    jest.mocked(apiClient.PUT).mockClear();
    jest.mocked(apiClient.DELETE).mockClear();

    await act(async () => {
      rotationListener();
    });

    expect(apiClient.DELETE).toHaveBeenCalledWith('/v1/me/device-tokens', {
      body: { token: 'ExponentPushToken[1]' },
    });
    expect(apiClient.PUT).toHaveBeenCalledWith('/v1/me/device-tokens', {
      body: { platform: 'ios', token: 'ExponentPushToken[2]' },
    });
  });

  it('does nothing when disabled', async () => {
    await renderHook(() => usePushTokenRotation('workspace-1', false));
    await act(async () => {});

    expect(Notifications.addPushTokenListener).not.toHaveBeenCalled();
    expect(apiClient.PUT).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    jest.mocked(getPushTokenAsync).mockResolvedValue({ status: 'denied' });
    const { unmount } = await renderHook(() => usePushTokenRotation('workspace-1', true));
    await unmount();

    expect(remove).toHaveBeenCalled();
  });
});
