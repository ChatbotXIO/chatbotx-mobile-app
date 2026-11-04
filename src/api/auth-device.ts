import * as SecureStore from 'expo-secure-store';

import { brand } from '@/config/brand';

const DEVICE_ID_KEY = `${brand.brandId}.mobileDeviceId`;

/**
 * A per-installation identifier used to bind refresh-token rotation and audit
 * records. It is deliberately separate from the white-label brand identifier:
 * every installation of a brand needs its own revocable token chain.
 */
export async function getMobileDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const deviceId = crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}
