import type { TFunction } from 'i18next';

import { AuthApiError } from '@/api/auth-endpoints';
import { isNetworkError } from '@/lib/describe-api-error';

const AUTH_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'errors.auth.invalidEmailOrPassword',
  INVALID_EMAIL: 'errors.auth.invalidEmail',
  INVALID_PASSWORD: 'errors.auth.invalidPassword',
  PASSWORD_TOO_SHORT: 'errors.auth.passwordTooShort',
  PASSWORD_TOO_LONG: 'errors.auth.passwordTooLong',
  USER_NOT_FOUND: 'errors.auth.userNotFound',
  EMAIL_NOT_VERIFIED: 'errors.auth.emailNotVerified',
  ACCOUNT_DELETION_PENDING: 'errors.auth.accountDeletionPending',
  UNAUTHORIZED: 'errors.unauthorized',
};

/** Maps a better-auth failure to localized copy by its machine `code`; the server's own
 * `message` is English-only and must never reach the UI. */
export function describeAuthError(error: unknown, t: TFunction): string {
  if (error instanceof AuthApiError && error.code) {
    const key = AUTH_ERROR_KEYS[error.code];
    if (key) return t(key);
  }
  if (isNetworkError(error)) return t('errors.network');
  return t('errors.unknown');
}
