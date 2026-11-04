import * as SecureStore from 'expo-secure-store';

import { getMobileDeviceId } from '@/api/auth-device';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'https://api.example.test',
        brandColor: '#000000',
        brandId: 'test-brand',
        brandScheme: 'test-brand',
      },
    },
  },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('getMobileDeviceId', () => {
  it('persists one generated identifier and returns it on later calls', async () => {
    const storage = new Map<string, string>();
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => storage.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');

    await expect(getMobileDeviceId()).resolves.toBe('00000000-0000-4000-8000-000000000001');
    await expect(getMobileDeviceId()).resolves.toBe('00000000-0000-4000-8000-000000000001');

    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'test-brand.mobileDeviceId',
      '00000000-0000-4000-8000-000000000001',
    );
  });
});
