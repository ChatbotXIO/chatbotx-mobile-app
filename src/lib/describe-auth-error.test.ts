import type { TFunction } from 'i18next';

import { AuthApiError } from '@/api/auth-endpoints';
import { describeAuthError } from '@/lib/describe-auth-error';

const t = ((key: string) => key) as TFunction;

describe('describeAuthError', () => {
  it.each([
    ['INVALID_EMAIL_OR_PASSWORD', 'errors.auth.invalidEmailOrPassword'],
    ['INVALID_EMAIL', 'errors.auth.invalidEmail'],
    ['INVALID_PASSWORD', 'errors.auth.invalidPassword'],
    ['PASSWORD_TOO_SHORT', 'errors.auth.passwordTooShort'],
    ['PASSWORD_TOO_LONG', 'errors.auth.passwordTooLong'],
    ['USER_NOT_FOUND', 'errors.auth.userNotFound'],
    ['EMAIL_NOT_VERIFIED', 'errors.auth.emailNotVerified'],
    ['UNAUTHORIZED', 'errors.unauthorized'],
  ])('maps %s to %s', (code, key) => {
    expect(describeAuthError(new AuthApiError('English text', code), t)).toBe(key);
  });

  it('maps a network TypeError to errors.network', () => {
    expect(describeAuthError(new TypeError('Network request failed'), t)).toBe('errors.network');
  });

  it('never surfaces the raw server message for an unmapped code', () => {
    expect(describeAuthError(new AuthApiError('Raw English', 'WHATEVER'), t)).toBe(
      'errors.unknown',
    );
    expect(describeAuthError(new Error('boom'), t)).toBe('errors.unknown');
  });
});
