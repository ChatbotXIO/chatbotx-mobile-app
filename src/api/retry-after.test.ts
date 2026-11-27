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

  it('falls back to the message when the header is empty or whitespace', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(parseRetryAfterMs('', 'Retry after 8s.')).toBe(8000);
    expect(parseRetryAfterMs('   ', 'Retry after 8s.')).toBe(8000);
  });

  it('falls back to the message when the header is garbage', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(parseRetryAfterMs('abc', 'Retry after 8s.')).toBe(8000);
  });

  it('reads an HTTP-date header relative to now', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
    expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:28:10 GMT', '')).toBe(10_000);
  });

  it('treats an HTTP-date in the past as no wait', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
    expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:27:00 GMT', '')).toBe(0);
  });

  it('returns null when nothing usable is present', () => {
    expect(parseRetryAfterMs(null, 'boom')).toBeNull();
    expect(parseRetryAfterMs('abc', '')).toBeNull();
    expect(parseRetryAfterMs('-3', '')).toBeNull();
  });
});
