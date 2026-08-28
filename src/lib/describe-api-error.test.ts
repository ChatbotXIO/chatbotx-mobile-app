import type { TFunction } from 'i18next';

import { ApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';

/** Identity-style mock: returns the key itself so assertions can check which key was resolved,
 * matching the pattern the rest of the app's i18n-aware tests use. */
const t = ((key: string) => key) as TFunction;

describe('describeApiError', () => {
  it('maps unauthorized to errors.unauthorized', () => {
    const error = new ApiError({ code: 'UNAUTHORIZED' });
    expect(describeApiError(error, t)).toBe('errors.unauthorized');
  });

  it('maps mustChangePassword to auth.changePasswordRequired', () => {
    const error = new ApiError({ code: 'FORBIDDEN', message: 'Password change required' });
    expect(describeApiError(error, t)).toBe('auth.changePasswordRequired');
  });

  it('maps notFound to errors.notFound', () => {
    const error = new ApiError({ code: 'NOT_FOUND' });
    expect(describeApiError(error, t)).toBe('errors.notFound');
  });

  it('maps workspaceBlocked/mac to errors.workspaceBlockedMac', () => {
    const error = new ApiError({ code: 'workspaceBlocked', message: 'Hit the contact limit' });
    expect(describeApiError(error, t)).toBe('errors.workspaceBlockedMac');
  });

  it('maps workspaceBlocked/trialExpired to errors.workspaceBlockedTrialExpired', () => {
    const error = new ApiError({ status: 402, message: 'Your trial has expired' });
    expect(describeApiError(error, t)).toBe('errors.workspaceBlockedTrialExpired');
  });

  it('falls back to the server message for workspaceBlocked/unknown', () => {
    const error = new ApiError({ status: 402, message: 'Something else' });
    expect(describeApiError(error, t)).toBe('Something else');
  });

  it("uses normalizeApiError's default message when workspaceBlocked/unknown has no server message", () => {
    const error = new ApiError({ status: 402 });
    expect(describeApiError(error, t)).toBe('This workspace is currently unavailable.');
  });

  it('returns the server message for unknown ApiError with a message', () => {
    const error = new ApiError({ code: 'SOMETHING_ELSE', message: 'weird failure' });
    expect(describeApiError(error, t)).toBe('weird failure');
  });

  it('falls back to errors.unknown for a non-ApiError Error', () => {
    expect(describeApiError(new Error(''), t)).toBe('errors.unknown');
  });

  it("uses normalizeApiError's default message for a non-Error thrown value", () => {
    expect(describeApiError('not an error', t)).toBe('Unknown error');
  });
});
