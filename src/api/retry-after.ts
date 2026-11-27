const MAX_RETRY_AFTER_MS = 60_000;
const RETRY_AFTER_JITTER_MS = 1_000;
const RETRY_AFTER_MESSAGE_PATTERN = /retry after (\d+)s/i;

/** Reads the server's requested wait from a `Retry-After` header value (seconds), falling back to
 * the "Retry after Ns" text the API puts in its 429 message. Returns `null` when neither is
 * present. A little jitter is added so clients released by the same rate-limit window don't all
 * retry in lockstep; the result is capped so a bad value can't stall retries indefinitely. */
export function parseRetryAfterMs(header: string | null, message: string): number | null {
  const raw = header ?? RETRY_AFTER_MESSAGE_PATTERN.exec(message)?.[1] ?? null;
  const seconds = raw === null ? Number.NaN : Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(MAX_RETRY_AFTER_MS, seconds * 1000 + Math.random() * RETRY_AFTER_JITTER_MS);
}
