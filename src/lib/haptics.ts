/**
 * Thin wrapper around `expo-haptics`. Every UI primitive that fires a haptic goes through here
 * instead of importing `expo-haptics` directly, so the "no-op on web + never throw" guard lives
 * in exactly one place.
 *
 * - Web has no haptics engine; `expo-haptics` methods are unimplemented there, so we short-circuit
 *   on `Platform.OS === 'web'` rather than relying on the module to no-op gracefully.
 * - Haptics can throw *or reject* on devices/simulators without a Taptic Engine (or with OS-level
 *   haptics disabled, or under Jest where the native module isn't linked at all) — every call is
 *   both wrapped in try/catch (for synchronous throws) and given a no-op `.catch()` (for async
 *   rejections, which a bare try/catch around a fire-and-forget promise does NOT catch) so a
 *   haptic failure never surfaces as a crash or an unhandled promise rejection.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind =
  'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

function swallow(): void {
  // Haptics are a nice-to-have — never worth surfacing to the caller or crashing over.
}

/** Fires a haptic feedback pulse for the given semantic kind. Fire-and-forget: callers don't need
 * to await this, and it never rejects. */
export function triggerHaptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;

  try {
    switch (kind) {
      case 'selection':
        Haptics.selectionAsync().catch(swallow);
        return;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);
        return;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(swallow);
        return;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(swallow);
        return;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);
        return;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow);
        return;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow);
        return;
    }
  } catch {
    swallow();
  }
}
