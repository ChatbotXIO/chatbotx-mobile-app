import { parseRetryAfterMs } from './retry-after';

describe('parseRetryAfterMs', () => {
  afterEach(() => jest.restoreAllMocks());

  it('prefers the header over the message', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(parseRetryAfterMs('4', 'Too many requests. Retry after 8s.')).toBe(4000);
  });

  it('falls back to the message text', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(parseRetryAfterMs(null, 'Too many requests. Retry after 8s.')).toBe(8000);
  });

  it('adds jitter below one second', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(parseRetryAfterMs('2', '')).toBe(2500);
  });

  it('caps absurd values', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(parseRetryAfterMs('9999', '')).toBe(60_000);
  });

  it('returns null when nothing usable is present', () => {
    expect(parseRetryAfterMs(null, 'boom')).toBeNull();
    expect(parseRetryAfterMs('abc', '')).toBeNull();
    expect(parseRetryAfterMs('-3', '')).toBeNull();
  });
});
