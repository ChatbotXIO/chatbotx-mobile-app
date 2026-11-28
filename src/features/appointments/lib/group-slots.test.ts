import { availabilityRange, groupSlotsByDay, isValidTimeZone, toDateKey } from './group-slots';

const slot = (startAt: string) => ({ startAt, endAt: startAt });

describe('groupSlotsByDay', () => {
  it('groups by the calendar day in the chosen timezone, sorted', () => {
    // 23:30Z on Jan 1 is already Jan 2 in Tokyo (UTC+9) but still Jan 1 in UTC.
    const slots = [
      slot('2026-01-02T01:00:00Z'),
      slot('2026-01-01T23:30:00Z'),
      slot('2026-01-01T02:00:00Z'),
    ];
    expect(groupSlotsByDay(slots, 'UTC').map((d) => [d.dateKey, d.slots.length])).toEqual([
      ['2026-01-01', 2],
      ['2026-01-02', 1],
    ]);
    expect(groupSlotsByDay(slots, 'Asia/Tokyo').map((d) => [d.dateKey, d.slots.length])).toEqual([
      ['2026-01-01', 1],
      ['2026-01-02', 2],
    ]);
  });

  it('keeps slots in order across the US spring-forward DST gap', () => {
    // 2026-03-08: 02:00 America/New_York jumps to 03:00 (EST -5 → EDT -4).
    const slots = [
      slot('2026-03-08T06:30:00Z'), // 01:30 EST
      slot('2026-03-08T07:00:00Z'), // 03:00 EDT
      slot('2026-03-09T03:59:00Z'), // 23:59 EDT, still Mar 8
      slot('2026-03-09T04:00:00Z'), // 00:00 EDT Mar 9
    ];
    const days = groupSlotsByDay(slots, 'America/New_York');
    expect(days.map((d) => [d.dateKey, d.slots.length])).toEqual([
      ['2026-03-08', 3],
      ['2026-03-09', 1],
    ]);
  });

  it('handles the fall-back day (25h) without dropping slots', () => {
    // 2026-11-01: 02:00 EDT falls back to 01:00 EST — 01:30 happens twice.
    const slots = [slot('2026-11-01T05:30:00Z'), slot('2026-11-01T06:30:00Z')];
    expect(groupSlotsByDay(slots, 'America/New_York')).toHaveLength(1);
  });

  it('returns an empty list for no slots', () => {
    expect(groupSlotsByDay([], 'UTC')).toEqual([]);
  });
});

describe('toDateKey / isValidTimeZone', () => {
  it('resolves the date in the zone', () => {
    expect(toDateKey('2026-01-01T23:30:00Z', 'Asia/Tokyo')).toBe('2026-01-02');
  });
  it('validates IANA names', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});

describe('availabilityRange', () => {
  it('spans the requested days, clamped to 90', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(availabilityRange('UTC', now, 30)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(availabilityRange('UTC', now, 500).endDate).toBe('2026-04-01');
  });
});
