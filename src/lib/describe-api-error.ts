import type { TFunction } from 'i18next';

import { normalizeApiError } from '@/api/errors';

/**
 * Centralizes the `NormalizedApiError` → user-facing string mapping duplicated across several
 * screens (conversations list, workspace picker, contact panel, contacts directory, members,
 * chat screen) — each previously re-implemented its own ternary chain over `normalizeApiError`.
 *
 * For `workspaceBlocked`, this returns the flat `errors.workspaceBlocked*` copy suitable for a
 * single-line `ErrorBanner`. Screens that render a full-screen gate for that kind should keep
 * branching on `normalizeApiError(error).kind === 'workspaceBlocked'` themselves (see
 * `WorkspaceBlockedGate`, which needs the `reason` to pick MAC-limit vs trial-expired copy, not
 * just a string) — `describeApiError` is for the inline-banner case, not a replacement for that
 * branch.
 */
export function describeApiError(error: unknown, t: TFunction): string {
  const normalized = normalizeApiError(error);

  switch (normalized.kind) {
    case 'unauthorized':
      return t('errors.unauthorized');
    case 'mustChangePassword':
      return t('auth.changePasswordRequired');
    case 'notFound':
      return t('errors.notFound');
    case 'workspaceBlocked':
      if (normalized.reason === 'mac') return t('errors.workspaceBlockedMac');
      if (normalized.reason === 'trialExpired') return t('errors.workspaceBlockedTrialExpired');
      return normalized.message || t('errors.workspaceBlocked');
    case 'unknown':
      return normalized.message || t('errors.unknown');
    default:
      return exhaustiveFallback(normalized, t);
  }
}

/** Compile-time exhaustiveness guard: if `NormalizedApiError` ever grows a new `kind`, this fails
 * to typecheck rather than silently falling through at runtime. */
function exhaustiveFallback(value: never, t: TFunction): string {
  void value;
  return t('errors.unknown');
}
