/** Channels that enforce a customer-service window: free-form replies are only allowed for 24h
 * after the contact's last inbound message. Other channels (webchat, email, ...) never lock. */
const WINDOWED_CHANNELS: ReadonlySet<string> = new Set(['messenger', 'instagram', 'whatsapp']);

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
const MESSAGING_WINDOW_WARN_MS = 2 * 60 * 60 * 1000;

export type MessagingWindow =
  | { status: 'none' }
  | { status: 'open' }
  | { status: 'closing'; remainingMs: number }
  | { status: 'closed' };

/** `lastIncomingAt` null on a windowed channel means the contact never wrote in — nothing to
 * reply to freely, so the window is treated as closed. */
export function getMessagingWindow(
  channel: string | null | undefined,
  lastIncomingAt: string | null | undefined,
  now: number = Date.now(),
): MessagingWindow {
  if (!channel || !WINDOWED_CHANNELS.has(channel)) return { status: 'none' };
  if (!lastIncomingAt) return { status: 'closed' };

  const lastIncoming = new Date(lastIncomingAt).getTime();
  if (Number.isNaN(lastIncoming)) return { status: 'none' };

  const remainingMs = lastIncoming + MESSAGING_WINDOW_MS - now;
  if (remainingMs <= 0) return { status: 'closed' };
  if (remainingMs <= MESSAGING_WINDOW_WARN_MS) return { status: 'closing', remainingMs };
  return { status: 'open' };
}

/** "1h 20m" / "45m" — minutes are rounded up so the label never shows 0m while still open. */
export function formatRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
