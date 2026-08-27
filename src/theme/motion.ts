/**
 * Motion tokens re-exported from tokens.ts under friendlier names, plus a `useReducedMotion`
 * hook so components can short-circuit springs/entrance animations for users with the OS
 * "reduce motion" accessibility setting on, without importing reanimated directly everywhere.
 */
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

import { motionDurations, motionEasings, motionSprings, pressScale } from './tokens';

export const durations = motionDurations;
export const easings = motionEasings;
export const springs = motionSprings;
export { pressScale };

/** Wraps reanimated's device-level reduced-motion signal. Components should check this before
 * kicking off a spring/entrance animation and fall back to an instant state change (or a plain
 * opacity fade at `durations.instant`) when it's `true`. */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}
