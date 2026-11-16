const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimum wait after the user taps "Later" (or swipes the sheet away) before asking again. */
export const PUSH_PROMPT_REASK_INTERVAL_MS = 3 * MS_PER_DAY;

/** After this many dismissals the in-app prompt stops for good; Settings still has the toggle. */
export const PUSH_PROMPT_MAX_DISMISSALS = 2;

export interface PushPromptInput {
  /** `Device.isDevice` — remote push does not work on simulators/emulators. */
  isPhysicalDevice: boolean;
  /** OS permission status from `Notifications.getPermissionsAsync()`. */
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  /** Persisted user intent (`useSettingsStore.pushEnabled`). */
  pushEnabled: boolean;
  dismissCount: number;
  lastDismissedAt: number | null;
  now: number;
}

/**
 * Decides whether to show the in-app "soft ask" that precedes the one-shot OS permission dialog.
 * Only an undecided permission qualifies: `granted` means the user turned push off deliberately
 * (the Settings toggle owns that), and `denied` can no longer be re-prompted by the OS, so the
 * Settings screen is the only place to recover from it.
 */
export function shouldShowPushPrompt({
  isPhysicalDevice,
  permissionStatus,
  pushEnabled,
  dismissCount,
  lastDismissedAt,
  now,
}: PushPromptInput): boolean {
  if (!isPhysicalDevice || pushEnabled || permissionStatus !== 'undetermined') return false;
  if (dismissCount >= PUSH_PROMPT_MAX_DISMISSALS) return false;
  if (dismissCount === 0 || lastDismissedAt === null) return true;
  return now - lastDismissedAt >= PUSH_PROMPT_REASK_INTERVAL_MS;
}
