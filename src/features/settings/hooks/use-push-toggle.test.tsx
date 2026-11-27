import { act, renderHook } from '@testing-library/react-native';

import { useSettingsStore } from '@/stores/use-settings-store';

import { PushPermissionError } from '@/features/settings/api/use-device-token';
import { usePushToggle } from './use-push-toggle';

const mockToast = jest.fn();
const mockRegister = jest.fn();
const mockUnregister = jest.fn();

type Callbacks = { onSuccess?: () => void; onError?: (error: unknown) => void };

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('@/components/ui/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/features/settings/api/use-device-token', () => {
  class PushPermissionError extends Error {}
  return {
    PushPermissionError,
    useRegisterDeviceToken: () => ({ mutate: mockRegister, isPending: false }),
    useUnregisterDeviceToken: () => ({ mutate: mockUnregister, isPending: false }),
  };
});

function callbacksOf(mock: jest.Mock): Callbacks {
  return mock.mock.calls[0][1] as Callbacks;
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ pushEnabled: false });
});

describe('usePushToggle', () => {
  it('turns the flag on after a successful enable, without a toast', async () => {
    const { result } = await renderHook(() => usePushToggle());

    await act(async () => result.current.enable());
    await act(async () => callbacksOf(mockRegister).onSuccess?.());

    expect(useSettingsStore.getState().pushEnabled).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('clears the flag and toasts on a generic enable error', async () => {
    useSettingsStore.setState({ pushEnabled: true });
    const { result } = await renderHook(() => usePushToggle());

    await act(async () => result.current.enable());
    await act(async () => callbacksOf(mockRegister).onError?.(new Error('network')));

    expect(useSettingsStore.getState().pushEnabled).toBe(false);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('clears the flag silently when the OS permission is denied', async () => {
    const { result } = await renderHook(() => usePushToggle());

    await act(async () => result.current.enable());
    await act(async () => callbacksOf(mockRegister).onError?.(new PushPermissionError('denied')));

    expect(useSettingsStore.getState().pushEnabled).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('restores the flag and toasts when disabling fails', async () => {
    useSettingsStore.setState({ pushEnabled: true });
    const { result } = await renderHook(() => usePushToggle());

    await act(async () => result.current.disable());
    expect(useSettingsStore.getState().pushEnabled).toBe(false);

    await act(async () => callbacksOf(mockUnregister).onError?.(new Error('network')));

    expect(useSettingsStore.getState().pushEnabled).toBe(true);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });
});
