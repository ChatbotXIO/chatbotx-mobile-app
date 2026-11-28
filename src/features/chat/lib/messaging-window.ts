import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

/** Server-owned messaging window (`contactInboxes[].messagingWindow`). The server decides, per
 * channel, when free-form replies stop being allowed; the app only compares the absolute
 * timestamps it hands back against the local clock. */
export type ServerMessagingWindow = NonNullable<
  ConversationListItem['contactInboxes']
>[number]['messagingWindow'];

const MESSAGING_WINDOW_WARN_MS = 2 * 60 * 60 * 1000;

export type MessagingWindow =
  | { kind: 'free' }
  | { kind: 'closing'; remainingMs: number }
  | { kind: 'humanAgent'; remainingMs: number }
  | { kind: 'closed'; channel: string | null };

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/** Maps the server field to the UI model. A missing field (older backend) never locks. */
export function deriveMessagingWindow(
  server: ServerMessagingWindow | null | undefined,
  channel: string | null | undefined,
  now: number = Date.now(),
): MessagingWindow {
  if (!server) return { kind: 'free' };
  const closed: MessagingWindow = { kind: 'closed', channel: channel ?? null };
  if (server.state === 'closed') return closed;
  if (server.state !== 'open' && server.state !== 'humanAgent') return { kind: 'free' };

  const closesAt = parseTime(server.closesAt);
  if (closesAt === null) return { kind: 'free' };

  const remainingMs = closesAt - now;
  if (remainingMs <= 0) return closed;
  if (remainingMs <= MESSAGING_WINDOW_WARN_MS) return { kind: 'closing', remainingMs };
  return server.state === 'humanAgent' ? { kind: 'humanAgent', remainingMs } : { kind: 'free' };
}

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** "3d 4h" / "1h 20m" / "45m" — minutes round up so the label never shows 0m while still open. */
export function formatRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (days > 0) return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
