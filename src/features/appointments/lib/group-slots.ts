/** Pure helpers for turning raw availability slots into a day → times picker. Everything is
 * computed with `Intl` in the chosen IANA timezone, so DST transitions fall out correctly (a day
 * is the *calendar* day in that zone, not a fixed 24h window from UTC). */

export interface Slot {
  startAt: string;
  endAt: string;
}

export interface SlotDay {
  /** `YYYY-MM-DD` in the chosen timezone. */
  dateKey: string;
  slots: Slot[];
}

const MAX_RANGE_DAYS = 90;

function datePartsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` of the instant as seen in `timeZone`. */
export function toDateKey(iso: string, timeZone: string): string {
  return datePartsFormatter(timeZone).format(new Date(iso));
}

export function groupSlotsByDay(slots: readonly Slot[], timeZone: string): SlotDay[] {
  const formatter = datePartsFormatter(timeZone);
  const byDay = new Map<string, Slot[]>();
  const sorted = [...slots].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  for (const slot of sorted) {
    const key = formatter.format(new Date(slot.startAt));
    byDay.set(key, [...(byDay.get(key) ?? []), slot]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, daySlots]) => ({ dateKey, slots: daySlots }));
}

export function formatSlotTime(iso: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatSlotDateTime(iso: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Availability window `[today, today + days]` as `YYYY-MM-DD` in `timeZone`, clamped to the
 * API's 90-day maximum. */
export function availabilityRange(
  timeZone: string,
  now: Date = new Date(),
  days: number = MAX_RANGE_DAYS,
): { startDate: string; endDate: string } {
  const span = Math.min(days, MAX_RANGE_DAYS);
  const startDate = datePartsFormatter(timeZone).format(now);
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + span);
  return { startDate, endDate: end.toISOString().slice(0, 10) };
}
