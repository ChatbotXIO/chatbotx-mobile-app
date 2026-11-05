import { botState, isBotActive, isUnread } from './conversation-status';

describe('isBotActive', () => {
  it('returns true when the bot is enabled, regardless of botResumeAt', () => {
    expect(isBotActive(true, null)).toBe(true);
    expect(isBotActive(true, new Date(Date.now() + 60_000).toISOString())).toBe(true);
  });

  it('returns false (paused) when disabled and botResumeAt is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBotActive(false, future)).toBe(false);
  });

  it('returns true (auto-resumed) when disabled and botResumeAt is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isBotActive(false, past)).toBe(true);
  });

  it('returns false when disabled with no botResumeAt', () => {
    expect(isBotActive(false, null)).toBe(false);
  });

  it('respects an explicit `now` for deterministic testing', () => {
    const resumeAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const beforeResume = new Date('2025-12-31T00:00:00.000Z').getTime();
    const afterResume = new Date('2026-01-02T00:00:00.000Z').getTime();
    expect(isBotActive(false, resumeAt, beforeResume)).toBe(false);
    expect(isBotActive(false, resumeAt, afterResume)).toBe(true);
  });
});

describe('isUnread', () => {
  it('returns true when lastActivityAt is newer than agentLastReadAt', () => {
    expect(
      isUnread({
        lastActivityAt: '2026-01-02T00:00:00.000Z',
        agentLastReadAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('returns false when agentLastReadAt is newer than or equal to lastActivityAt', () => {
    expect(
      isUnread({
        lastActivityAt: '2026-01-01T00:00:00.000Z',
        agentLastReadAt: '2026-01-02T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('returns true when there is activity but agentLastReadAt is null', () => {
    expect(isUnread({ lastActivityAt: '2026-01-01T00:00:00.000Z', agentLastReadAt: null })).toBe(
      true,
    );
  });

  it('returns false when there is no lastActivityAt at all', () => {
    expect(isUnread({ lastActivityAt: null, agentLastReadAt: null })).toBe(false);
    expect(isUnread({ lastActivityAt: null, agentLastReadAt: '2026-01-01T00:00:00.000Z' })).toBe(
      false,
    );
  });
});

describe('botState', () => {
  const now = new Date('2026-01-10T00:00:00Z').getTime();
  it('is on when enabled or when the auto-resume time has passed', () => {
    expect(botState(true, null, now)).toBe('on');
    expect(botState(false, '2026-01-09T00:00:00Z', now)).toBe('on');
  });
  it('is paused while an auto-resume is still scheduled', () => {
    expect(botState(false, '2026-01-11T00:00:00Z', now)).toBe('paused');
  });
  it('is off when disabled with no auto-resume', () => {
    expect(botState(false, null, now)).toBe('off');
  });
});
