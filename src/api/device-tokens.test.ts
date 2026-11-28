import * as SecureStore from 'expo-secure-store';

import { apiClient } from '@/api/client';
import {
  LAST_REGISTERED_TOKEN_KEY,
  UNREGISTER_TIMEOUT_MS,
  registerDeviceToken,
  unregisterCachedDeviceToken,
} from './device-tokens';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('@/api/client', () => ({
  apiClient: { DELETE: jest.fn(), PUT: jest.fn() },
}));

const ok = { data: undefined, error: undefined } as never;

describe('device-tokens', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('caches the token only after a successful register', async () => {
    (apiClient.PUT as jest.Mock).mockResolvedValueOnce({ error: { message: 'x' } } as never);
    await expect(registerDeviceToken('t1')).rejects.toBeDefined();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();

    (apiClient.PUT as jest.Mock).mockResolvedValueOnce(ok);
    await registerDeviceToken('t1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(LAST_REGISTERED_TOKEN_KEY, 't1');
  });

  it('does nothing when no token is cached', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    await unregisterCachedDeviceToken({ bestEffort: true });
    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });

  it('strict mode throws and keeps the cache on failure', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('t1');
    (apiClient.DELETE as jest.Mock).mockResolvedValue({ error: { message: 'x' } } as never);
    await expect(unregisterCachedDeviceToken()).rejects.toBeDefined();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('best-effort mode swallows errors and clears the cache', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('t1');
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    (apiClient.DELETE as jest.Mock).mockResolvedValue({ error: { message: 'x' } } as never);
    await expect(unregisterCachedDeviceToken({ bestEffort: true })).resolves.toBeUndefined();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(LAST_REGISTERED_TOKEN_KEY);
  });

  it('best-effort mode resolves after the timeout when the request hangs', async () => {
    jest.useFakeTimers();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('t1');
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.mocked(apiClient.DELETE).mockReturnValue(new Promise(() => {}) as never);

    const done = jest.fn();
    void unregisterCachedDeviceToken({ bestEffort: true }).then(done);
    await jest.advanceTimersByTimeAsync(UNREGISTER_TIMEOUT_MS);

    expect(done).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
