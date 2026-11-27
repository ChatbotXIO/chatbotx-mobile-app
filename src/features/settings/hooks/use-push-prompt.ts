import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { usePushToggle } from '@/features/settings/hooks/use-push-toggle';
import { shouldShowPushPrompt } from '@/features/settings/lib/push-prompt-policy';
import { useSettingsStore, waitForSettingsHydration } from '@/stores/use-settings-store';

interface PushPrompt {
  sheetRef: RefObject<BottomSheetModal | null>;
  handleEnable: () => void;
  handleLater: () => void;
}

/**
 * Drives the in-app push "soft ask": once per mount of the signed-in shell, checks whether the OS
 * permission is still undecided (and the user hasn't recently said "Later") and, if so, presents
 * the sheet. Only after the user opts in do we spend the one-shot OS permission dialog, via the
 * same register mutation the Settings toggle uses.
 */
export function usePushPrompt(workspaceId: string): PushPrompt {
  const sheetRef = useRef<BottomSheetModal>(null);
  const hasCheckedRef = useRef(false);
  const { enable: handleEnable } = usePushToggle();
  const recordPushPromptDismissed = useSettingsStore((state) => state.recordPushPromptDismissed);

  useEffect(() => {
    if (!workspaceId || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    void (async () => {
      try {
        await waitForSettingsHydration();
        const permission = await Notifications.getPermissionsAsync();
        const { pushEnabled, pushPromptDismissCount, pushPromptLastDismissedAt } =
          useSettingsStore.getState();

        const shouldShow = shouldShowPushPrompt({
          isPhysicalDevice: Device.isDevice,
          permissionStatus: permission.status,
          pushEnabled,
          dismissCount: pushPromptDismissCount,
          lastDismissedAt: pushPromptLastDismissedAt,
          now: Date.now(),
        });
        if (shouldShow) sheetRef.current?.present();
      } catch {
        // Best-effort nicety: a failed permission lookup just means no prompt this session; the
        // Settings toggle remains the manual path.
      }
    })();
  }, [workspaceId]);

  const handleLater = useCallback(() => {
    recordPushPromptDismissed();
  }, [recordPushPromptDismissed]);

  return { sheetRef, handleEnable, handleLater };
}
