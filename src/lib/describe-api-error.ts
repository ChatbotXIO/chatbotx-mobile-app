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
/** `fetch` rejects with a `TypeError` when the request never reached the server (offline, DNS,
 * TLS) — React Native surfaces "Network request failed" this way. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

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
      return t('errors.workspaceBlocked');
    case 'tooManyRequests':
      return t('errors.tooManyRequests');
    case 'invalidRequestData':
      return t('errors.invalidRequest');
    case 'imagesNotSupportedOnChannel':
      return t('errors.imagesNotSupported');
    case 'unknown':
      return isNetworkError(error) ? t('errors.network') : t('errors.unknown');
    case 'invalidCursor':
    case 'workspaceSelectionRequired':
      return t('errors.unknown');
    default:
      return exhaustiveFallback(normalized, t);
  }
}

/** Resolves a persisted `NormalizedApiError['kind']` (e.g. stored on a failed optimistic message,
 * where only a serializable code — never raw server text — is kept) to localized copy. */
export function describeApiErrorKind(kind: string | undefined, t: TFunction): string | null {
  switch (kind) {
    case 'unauthorized':
      return t('errors.unauthorized');
    case 'tooManyRequests':
      return t('errors.tooManyRequests');
    case 'invalidRequestData':
      return t('errors.invalidRequest');
    case 'imagesNotSupportedOnChannel':
      return t('errors.imagesNotSupported');
    case 'workspaceBlocked':
      return t('errors.workspaceBlocked');
    case 'network':
      return t('errors.network');
    default:
      return null;
  }
}

/** Compile-time exhaustiveness guard: if `NormalizedApiError` ever grows a new `kind`, this fails
 * to typecheck rather than silently falling through at runtime. */
function exhaustiveFallback(value: never, t: TFunction): string {
  void value;
  return t('errors.unknown');
}
