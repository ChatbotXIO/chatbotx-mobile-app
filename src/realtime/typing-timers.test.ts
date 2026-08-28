import { clearAllTypingTimers, clearTypingTimer, scheduleTypingExpiry } from './typing-timers';

describe('typing-timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearAllTypingTimers();
  });

  afterEach(() => {
    clearAllTypingTimers();
    jest.useRealTimers();
  });

  it('calls onExpire after the given number of seconds', () => {
    const onExpire = jest.fn();
    scheduleTypingExpiry('conv-1', 5, onExpire);

    jest.advanceTimersByTime(4999);
    expect(onExpire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('resets the countdown when scheduled again for the same conversation', () => {
    const onExpire = jest.fn();
    scheduleTypingExpiry('conv-1', 5, onExpire);

    jest.advanceTimersByTime(3000);
    scheduleTypingExpiry('conv-1', 5, onExpire);

    jest.advanceTimersByTime(4000);
    expect(onExpire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('clearTypingTimer prevents onExpire from firing', () => {
    const onExpire = jest.fn();
    scheduleTypingExpiry('conv-1', 5, onExpire);

    clearTypingTimer('conv-1');
    jest.advanceTimersByTime(10_000);

    expect(onExpire).not.toHaveBeenCalled();
  });

  it('clearTypingTimer is a no-op for an unknown conversationId', () => {
    expect(() => clearTypingTimer('does-not-exist')).not.toThrow();
  });

  it('tracks timers independently per conversation', () => {
    const onExpireA = jest.fn();
    const onExpireB = jest.fn();
    scheduleTypingExpiry('conv-a', 2, onExpireA);
    scheduleTypingExpiry('conv-b', 5, onExpireB);

    jest.advanceTimersByTime(2000);
    expect(onExpireA).toHaveBeenCalledTimes(1);
    expect(onExpireB).not.toHaveBeenCalled();

    jest.advanceTimersByTime(3000);
    expect(onExpireB).toHaveBeenCalledTimes(1);
  });

  it('clearAllTypingTimers cancels every pending timer', () => {
    const onExpireA = jest.fn();
    const onExpireB = jest.fn();
    scheduleTypingExpiry('conv-a', 2, onExpireA);
    scheduleTypingExpiry('conv-b', 5, onExpireB);

    clearAllTypingTimers();
    jest.advanceTimersByTime(10_000);

    expect(onExpireA).not.toHaveBeenCalled();
    expect(onExpireB).not.toHaveBeenCalled();
  });

  it('defaults seconds=0 to firing immediately when advanced by 0ms (TTL math handled by caller)', () => {
    // Note: the "default to 5s when seconds is 0/undefined" fallback lives in the CALLER
    // (use-realtime-handlers.ts), not this scheduler — scheduleTypingExpiry always honors
    // whatever `seconds` it's given, including 0.
    const onExpire = jest.fn();
    scheduleTypingExpiry('conv-1', 0, onExpire);

    jest.advanceTimersByTime(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
