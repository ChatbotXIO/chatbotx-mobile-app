import { ApiError, normalizeApiError } from '@/api/errors';

describe('normalizeApiError', () => {
  it('maps the public API 403 trialExpired / macLimitReached codes to workspaceBlocked', () => {
    expect(
      normalizeApiError(new ApiError({ code: 'trialExpired', status: 403, message: 'x' })),
    ).toEqual({ kind: 'workspaceBlocked', reason: 'trialExpired', message: 'x' });
    expect(
      normalizeApiError(new ApiError({ code: 'macLimitReached', status: 403, message: 'y' })),
    ).toEqual({ kind: 'workspaceBlocked', reason: 'mac', message: 'y' });
  });

  it('treats INVALID_CHATBOT_TOKEN as unauthorized', () => {
    expect(normalizeApiError(new ApiError({ code: 'INVALID_CHATBOT_TOKEN', status: 401 }))).toEqual(
      {
        kind: 'unauthorized',
      },
    );
  });

  it('classifies 429, 422, cursor and workspace-selection errors', () => {
    expect(normalizeApiError(new ApiError({ code: 'tooManyRequests', status: 429 })).kind).toBe(
      'tooManyRequests',
    );
    expect(normalizeApiError(new ApiError({ code: 'invalidRequestData', status: 422 })).kind).toBe(
      'invalidRequestData',
    );
    expect(normalizeApiError(new ApiError({ code: 'invalidCursor', status: 400 })).kind).toBe(
      'invalidCursor',
    );
    expect(
      normalizeApiError(new ApiError({ code: 'WORKSPACE_SELECTION_REQUIRED', status: 400 })).kind,
    ).toBe('workspaceSelectionRequired');
    expect(
      normalizeApiError(new ApiError({ code: 'imagesNotSupportedOnChannel', status: 422 })).kind,
    ).toBe('imagesNotSupportedOnChannel');
  });

  it('returns mustChangePassword for FORBIDDEN with the change-password message', () => {
    const error = new ApiError({ code: 'FORBIDDEN', message: 'Password change required' });
    expect(normalizeApiError(error)).toEqual({ kind: 'mustChangePassword' });
  });

  it('returns unauthorized for UNAUTHORIZED code', () => {
    const error = new ApiError({ code: 'UNAUTHORIZED' });
    expect(normalizeApiError(error)).toEqual({ kind: 'unauthorized' });
  });

  it('returns unauthorized for status 401', () => {
    const error = new ApiError({ status: 401 });
    expect(normalizeApiError(error)).toEqual({ kind: 'unauthorized' });
  });

  it('classifies workspaceBlocked as mac when message mentions contact limit', () => {
    const error = new ApiError({ code: 'workspaceBlocked', message: 'Hit the contact limit' });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'mac',
      message: 'Hit the contact limit',
    });
  });

  it('classifies workspaceBlocked as trialExpired when message mentions trial/expired', () => {
    const error = new ApiError({ status: 402, message: 'Your trial has expired' });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'trialExpired',
      message: 'Your trial has expired',
    });
  });

  it('classifies workspaceBlocked as unknown when message matches neither pattern', () => {
    const error = new ApiError({ status: 402, message: 'Something else' });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'unknown',
      message: 'Something else',
    });
  });

  it('prefers a machine-readable data.reason over substring matching', () => {
    const error = new ApiError({
      status: 402,
      message: 'Some unrelated free-form copy that mentions nothing recognizable',
      data: { reason: 'mac' },
    });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'mac',
      message: 'Some unrelated free-form copy that mentions nothing recognizable',
    });
  });

  it('uses data.reason=trialExpired even when the message would substring-match mac', () => {
    const error = new ApiError({
      status: 402,
      message: 'reached the contact limit',
      data: { reason: 'trialExpired' },
    });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'trialExpired',
      message: 'reached the contact limit',
    });
  });

  it('falls back to substring matching when data.reason is an unrecognized value', () => {
    const error = new ApiError({
      status: 402,
      message: 'Your trial has expired',
      data: { reason: 'somethingUnexpected' },
    });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'trialExpired',
      message: 'Your trial has expired',
    });
  });

  it('falls back to substring matching when data is absent', () => {
    const error = new ApiError({ status: 402, message: 'Hit the contact limit' });
    expect(normalizeApiError(error)).toEqual({
      kind: 'workspaceBlocked',
      reason: 'mac',
      message: 'Hit the contact limit',
    });
  });

  it('defaults workspaceBlocked message when body has none', () => {
    const error = new ApiError({ status: 402 });
    const result = normalizeApiError(error);
    expect(result.kind).toBe('workspaceBlocked');
    if (result.kind === 'workspaceBlocked') {
      expect(result.message).toBe('This workspace is currently unavailable.');
    }
  });

  it('returns notFound for NOT_FOUND code', () => {
    const error = new ApiError({ code: 'NOT_FOUND' });
    expect(normalizeApiError(error)).toEqual({ kind: 'notFound' });
  });

  it('returns notFound for status 404', () => {
    const error = new ApiError({ status: 404 });
    expect(normalizeApiError(error)).toEqual({ kind: 'notFound' });
  });

  it('returns unknown with body message for unrecognized ApiError', () => {
    const error = new ApiError({ code: 'SOMETHING_ELSE', message: 'weird failure' });
    expect(normalizeApiError(error)).toEqual({ kind: 'unknown', message: 'weird failure' });
  });

  it('returns unknown with default message when ApiError body has no message', () => {
    const error = new ApiError({ code: 'SOMETHING_ELSE' });
    expect(normalizeApiError(error)).toEqual({ kind: 'unknown', message: 'Unknown error' });
  });

  it('returns unknown with the Error message for a non-ApiError Error', () => {
    expect(normalizeApiError(new Error('boom'))).toEqual({ kind: 'unknown', message: 'boom' });
  });

  it('returns a generic unknown for a non-Error thrown value', () => {
    expect(normalizeApiError('not an error')).toEqual({
      kind: 'unknown',
      message: 'Unknown error',
    });
  });
});
