/**
 * A `useReducedMotion` hook so components can short-circuit springs/entrance animations for
 * users with the OS "reduce motion" accessibility setting on, without importing reanimated
 * directly everywhere.
 */
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

/** Wraps reanimated's device-level reduced-motion signal. Components should check this before
 * kicking off a spring/entrance animation and fall back to an instant state change (or a plain
 * opacity fade at `durations.instant`) when it's `true`. */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}
