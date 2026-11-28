import {
  deriveMessagingWindow,
  formatRemaining,
  nextMessagingWindowBoundary,
  type ServerMessagingWindow,
} from './messaging-window';

const NOW = new Date('2026-01-02T12:00:00.000Z').getTime();
const HOUR = 3_600_000;
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString();
const win = (
  state: ServerMessagingWindow['state'],
  changesAt: string | null = null,
  closesAt: string | null = null,
): ServerMessagingWindow => ({ state, changesAt, closesAt });

describe('deriveMessagingWindow', () => {
  it.each(['unlimited', 'notApplicable', 'unknown'] as const)('is free for %s', (state) => {
    expect(deriveMessagingWindow(win(state), 'messenger', NOW)).toEqual({ kind: 'free' });
  });

  it('is free when the backend sends no field', () => {
    expect(deriveMessagingWindow(undefined, 'messenger', NOW)).toEqual({ kind: 'free' });
  });

  it('is free while open far from closing', () => {
    expect(deriveMessagingWindow(win('open', at(5), at(20)), 'whatsapp', NOW)).toEqual({
      kind: 'free',
    });
  });

  it('is closing within the last 2h', () => {
    expect(deriveMessagingWindow(win('open', at(1.5), at(1.5)), 'whatsapp', NOW)).toEqual({
      kind: 'closing',
      remainingMs: 1.5 * HOUR,
    });
  });

  it('reports humanAgent with the time left', () => {
    expect(deriveMessagingWindow(win('humanAgent', null, at(100)), 'messenger', NOW)).toEqual({
      kind: 'humanAgent',
      remainingMs: 100 * HOUR,
    });
  });

  it('is closing, not humanAgent, in the last 2h of the human-agent window', () => {
    expect(deriveMessagingWindow(win('humanAgent', null, at(1)), 'messenger', NOW)).toEqual({
      kind: 'closing',
      remainingMs: HOUR,
    });
  });

  it('is closed when the server says so', () => {
    expect(deriveMessagingWindow(win('closed'), 'tiktok', NOW)).toEqual({
      kind: 'closed',
      channel: 'tiktok',
    });
  });

  it('is closed once the local clock passes closesAt', () => {
    expect(deriveMessagingWindow(win('open', null, at(-0.1)), 'instagram', NOW)).toEqual({
      kind: 'closed',
      channel: 'instagram',
    });
  });
});

describe('nextMessagingWindowBoundary', () => {
  it('picks the earliest future boundary', () => {
    expect(nextMessagingWindowBoundary(win('open', at(10), at(24)), NOW)).toBe(NOW + 10 * HOUR);
    expect(nextMessagingWindowBoundary(win('open', at(23), at(24)), NOW)).toBe(NOW + 22 * HOUR);
  });

  it('is null when nothing is scheduled', () => {
    expect(nextMessagingWindowBoundary(win('unlimited'), NOW)).toBeNull();
    expect(nextMessagingWindowBoundary(win('closed', null, at(-1)), NOW)).toBeNull();
    expect(nextMessagingWindowBoundary(undefined, NOW)).toBeNull();
  });
});

describe('formatRemaining', () => {
  it('formats hours and minutes', () => {
    expect(formatRemaining(80 * 60_000)).toBe('1h 20m');
    expect(formatRemaining(60 * 60_000)).toBe('1h');
    expect(formatRemaining(45 * 60_000)).toBe('45m');
  });

  it('formats days', () => {
    expect(formatRemaining(100 * HOUR)).toBe('4d 4h');
    expect(formatRemaining(48 * HOUR)).toBe('2d');
  });

  it('never shows 0m', () => {
    expect(formatRemaining(1000)).toBe('1m');
  });
});
