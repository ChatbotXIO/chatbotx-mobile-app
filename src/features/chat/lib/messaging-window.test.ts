import { formatRemaining, getMessagingWindow } from './messaging-window';

const NOW = new Date('2026-01-02T12:00:00.000Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('getMessagingWindow', () => {
  it('never locks channels without a window', () => {
    expect(getMessagingWindow('webchat', hoursAgo(100), NOW)).toEqual({ status: 'none' });
    expect(getMessagingWindow(undefined, hoursAgo(100), NOW)).toEqual({ status: 'none' });
  });

  it('is open well inside 24h', () => {
    expect(getMessagingWindow('messenger', hoursAgo(5), NOW)).toEqual({ status: 'open' });
  });

  it('reports remaining time within the last 2h', () => {
    expect(getMessagingWindow('whatsapp', hoursAgo(22.5), NOW)).toEqual({
      status: 'closing',
      remainingMs: 1.5 * 3_600_000,
    });
  });

  it('is closed after 24h', () => {
    expect(getMessagingWindow('instagram', hoursAgo(24), NOW)).toEqual({ status: 'closed' });
  });

  it('is closed when the contact never wrote in', () => {
    expect(getMessagingWindow('messenger', null, NOW)).toEqual({ status: 'closed' });
  });
});

describe('formatRemaining', () => {
  it('formats hours and minutes', () => {
    expect(formatRemaining(80 * 60_000)).toBe('1h 20m');
    expect(formatRemaining(60 * 60_000)).toBe('1h');
    expect(formatRemaining(45 * 60_000)).toBe('45m');
  });

  it('never shows 0m', () => {
    expect(formatRemaining(1000)).toBe('1m');
  });
});
