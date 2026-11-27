import { renderHook } from '@testing-library/react-native';

import { revokeMobileToken } from '@/api/auth-endpoints';
import { clearAuthToken } from '@/api/auth-token';
import { clearCachedDeviceToken, unregisterCachedDeviceToken } from '@/api/device-tokens';
import { useSignOutLocally } from './use-sign-out';

const mockSetSignedOut = jest.fn();
const mockSetWorkspace = jest.fn();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/api/auth-endpoints', () => ({ revokeMobileToken: jest.fn() }));
jest.mock('@/api/auth-token', () => ({ clearAuthToken: jest.fn() }));
jest.mock('@/api/device-tokens', () => ({
  clearCachedDeviceToken: jest.fn(),
  unregisterCachedDeviceToken: jest.fn(),
}));
jest.mock('@/lib/query-client', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/stores/use-auth-store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ setSignedOut: mockSetSignedOut }),
}));
jest.mock('@/stores/use-workspace-store', () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({ setCurrentWorkspaceId: mockSetWorkspace }),
}));

describe('useSignOutLocally', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(revokeMobileToken).mockResolvedValue(undefined as never);
    jest.mocked(clearAuthToken).mockResolvedValue(undefined as never);
  });

  it('unregisters before revoking and clearing the credential', async () => {
    const { result } = await renderHook(() => useSignOutLocally());
    await result.current();

    const unregisterOrder = jest.mocked(unregisterCachedDeviceToken).mock.invocationCallOrder[0];
    expect(unregisterCachedDeviceToken).toHaveBeenCalledWith({ bestEffort: true });
    expect(unregisterOrder).toBeLessThan(
      jest.mocked(revokeMobileToken).mock.invocationCallOrder[0],
    );
    expect(unregisterOrder).toBeLessThan(jest.mocked(clearAuthToken).mock.invocationCallOrder[0]);
    expect(mockSetSignedOut).toHaveBeenCalled();
  });

  it('still signs out when unregister rejects', async () => {
    jest.mocked(unregisterCachedDeviceToken).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useSignOutLocally());
    await result.current().catch(() => {});

    expect(mockSetSignedOut).toHaveBeenCalled();
  });

  it('clears the cache without a network unregister when revokeToken is false', async () => {
    const { result } = await renderHook(() => useSignOutLocally());
    await result.current({ revokeToken: false });

    expect(clearCachedDeviceToken).toHaveBeenCalled();
    expect(unregisterCachedDeviceToken).not.toHaveBeenCalled();
  });
});
