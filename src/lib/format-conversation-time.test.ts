import dayjs from 'dayjs';

import { formatCompactDuration, formatConversationTime } from './format-conversation-time';

const labels = { yesterday: 'Yesterday' };
// Wed 15 Oct 2025, 15:30 local time.
const now = new Date(2025, 9, 15, 15, 30);

describe('formatConversationTime', () => {
  beforeAll(() => dayjs.locale('en'));

  it('shows clock time for today', () => {
    expect(formatConversationTime(new Date(2025, 9, 15, 14, 2), now, labels)).toBe('14:02');
  });

  it('uses calendar days, so 23:50 last night is "yesterday" even when under 24h ago', () => {
    expect(formatConversationTime(new Date(2025, 9, 14, 23, 50), now, labels)).toBe('Yesterday');
  });

  it('shows a short weekday within the last week', () => {
    expect(formatConversationTime(new Date(2025, 9, 11, 9, 0), now, labels)).toBe('Sat');
  });

  it('shows day and month for older dates in the same year', () => {
    expect(formatConversationTime(new Date(2025, 9, 8, 9, 0), now, labels)).toBe('8 Oct');
  });

  it('shows a numeric date for other years', () => {
    expect(formatConversationTime(new Date(2024, 9, 12, 9, 0), now, labels)).toBe('12/10/24');
  });

  it('treats a future timestamp (clock skew) as today', () => {
    expect(formatConversationTime(new Date(2025, 9, 15, 16, 0), now, labels)).toBe('16:00');
  });
});

describe('formatCompactDuration', () => {
  it.each([
    [0, '1m'],
    [59 * 60_000, '59m'],
    [60 * 60_000, '1h'],
    [23 * 3_600_000 + 59 * 60_000, '23h'],
    [48 * 3_600_000, '2d'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatCompactDuration(ms)).toBe(expected);
  });
});
