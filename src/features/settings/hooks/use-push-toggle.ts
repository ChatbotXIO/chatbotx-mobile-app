import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import {
  PushPermissionError,
  useRegisterDeviceToken,
  useUnregisterDeviceToken,
} from '@/features/settings/api/use-device-token';
import { useSettingsStore } from '@/stores/use-settings-store';

interface PushToggle {
  enable: () => void;
  disable: () => void;
  isPending: boolean;
}

/**
 * Owns the push on/off flow shared by the Settings toggle and the in-app soft-ask. The persisted
 * flag only flips to "on" once the token registers, and is rolled back whenever the backend call
 * fails so the UI never disagrees with the server. A permission denial is the user's own choice,
 * so it rolls back silently instead of suggesting a retry.
 */
export function usePushToggle(): PushToggle {
  const { t } = useTranslation();
  const toast = useToast();
  const registerDeviceToken = useRegisterDeviceToken();
  const unregisterDeviceToken = useUnregisterDeviceToken();
  const setPushEnabled = useSettingsStore((state) => state.setPushEnabled);

  const { mutate: register } = registerDeviceToken;
  const { mutate: unregister } = unregisterDeviceToken;

  const enable = useCallback(() => {
    register(undefined, {
      onSuccess: () => setPushEnabled(true),
      onError: (error) => {
        setPushEnabled(false);
        if (error instanceof PushPermissionError) return;
        toast({ message: t('settings.pushRegisterFailed'), tone: 'danger' });
      },
    });
  }, [register, setPushEnabled, t, toast]);

  const disable = useCallback(() => {
    setPushEnabled(false);
    unregister(undefined, {
      onError: () => {
        setPushEnabled(true);
        toast({ message: t('settings.pushUnregisterFailed'), tone: 'danger' });
      },
    });
  }, [unregister, setPushEnabled, t, toast]);

  return {
    enable,
    disable,
    isPending: registerDeviceToken.isPending || unregisterDeviceToken.isPending,
  };
}
