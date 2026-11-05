import dayjs from 'dayjs';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const WEEKDAY_WINDOW_DAYS = 7;

interface ConversationTimeLabels {
  yesterday: string;
}

/**
 * Messenger/WhatsApp-style compact timestamp for a conversation row, in the active dayjs locale:
 * today → clock time, yesterday → label, within a week → short weekday, same year → "12 Oct",
 * otherwise a numeric date. Calendar days (not 24h windows) decide the bucket.
 */
export function formatConversationTime(
  date: string | Date,
  now: Date,
  labels: ConversationTimeLabels,
): string {
  const value = dayjs(date);
  const today = dayjs(now).startOf('day');
  const dayDiff = today.diff(value.startOf('day'), 'day');

  if (dayDiff <= 0) return value.format('HH:mm');
  if (dayDiff === 1) return labels.yesterday;
  if (dayDiff < WEEKDAY_WINDOW_DAYS) return value.format('ddd');
  if (value.year() === today.year()) return value.format('D MMM');
  return value.format('DD/MM/YY');
}

/** Compact elapsed time for "waiting" chips: 1m … 59m, 1h … 23h, 1d …. Never returns 0. */
export function formatCompactDuration(elapsedMs: number): string {
  const minutes = Math.max(1, Math.floor(elapsedMs / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  if (minutes < MINUTES_PER_DAY) return `${Math.floor(minutes / MINUTES_PER_HOUR)}h`;
  return `${Math.floor(minutes / MINUTES_PER_DAY)}d`;
}
