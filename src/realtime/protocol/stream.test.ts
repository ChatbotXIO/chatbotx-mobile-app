import { isRealtimeSeqAfter } from './stream';

describe('isRealtimeSeqAfter', () => {
  it('orders by milliseconds first', () => {
    expect(isRealtimeSeqAfter('1700000000001-0', '1700000000000-9')).toBe(true);
    expect(isRealtimeSeqAfter('1700000000000-9', '1700000000001-0')).toBe(false);
  });

  it('orders by sequence when milliseconds tie', () => {
    expect(isRealtimeSeqAfter('5-2', '5-1')).toBe(true);
    expect(isRealtimeSeqAfter('5-1', '5-1')).toBe(false);
  });

  it('compares numerically, not lexicographically', () => {
    expect(isRealtimeSeqAfter('10-0', '9-0')).toBe(true);
    expect(isRealtimeSeqAfter('9-10', '9-9')).toBe(true);
  });

  it('returns false for malformed ids instead of throwing', () => {
    expect(isRealtimeSeqAfter('abc', '1-0')).toBe(false);
    expect(isRealtimeSeqAfter('1-0', '')).toBe(false);
  });
});
