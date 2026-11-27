import { ApiError } from '@/api/errors';

import { DEFAULT_RETRY_DELAY_MS, retryDelay, shouldRetry } from './query-retry';

const apiError = (status: number, message = 'boom') => new ApiError({ status, message });

describe('shouldRetry', () => {
  it('retries a 429 once', () => {
    expect(shouldRetry(0, apiError(429))).toBe(true);
    expect(shouldRetry(1, apiError(429))).toBe(false);
  });

  it('does not retry other 4xx responses', () => {
    expect(shouldRetry(0, apiError(400))).toBe(false);
    expect(shouldRetry(0, apiError(404))).toBe(false);
  });

  it('retries 5xx and non-API errors once', () => {
    expect(shouldRetry(0, apiError(500))).toBe(true);
    expect(shouldRetry(0, new Error('network'))).toBe(true);
    expect(shouldRetry(1, new Error('network'))).toBe(false);
  });
});

describe('retryDelay', () => {
  afterEach(() => jest.restoreAllMocks());

  it('waits the server-requested delay on a 429', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(retryDelay(0, apiError(429, 'Too many requests. Retry after 8s.'))).toBe(8000);
  });

  it('falls back to the default when a 429 carries no delay', () => {
    expect(retryDelay(0, apiError(429, 'Too many requests'))).toBe(DEFAULT_RETRY_DELAY_MS);
  });

  it('uses the default delay for anything else', () => {
    expect(retryDelay(0, apiError(500))).toBe(DEFAULT_RETRY_DELAY_MS);
    expect(retryDelay(0, new Error('network'))).toBe(DEFAULT_RETRY_DELAY_MS);
  });
});
