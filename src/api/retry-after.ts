const MAX_RETRY_AFTER_MS = 60_000;
const RETRY_AFTER_JITTER_MS = 1_000;
const RETRY_AFTER_MESSAGE_PATTERN = /retry after (\d+)s/i;
const DELTA_SECONDS_PATTERN = /^\d+$/;
// Every RFC 9110 HTTP-date has a day/month name; this keeps `Date.parse` from reading junk like
// "-3" as a year.
const HTTP_DATE_HINT = /[a-z]/i;

/** `Retry-After` is either delta-seconds or an HTTP-date (RFC 9110 §10.2.3). Returns `null` for an
 * empty, malformed or unparseable value so the caller can fall back to the message text. */
function secondsFromHeader(header: string | null): number | null {
  const value = header?.trim();
  if (!value) return null;
  if (DELTA_SECONDS_PATTERN.test(value)) return Number(value);
  if (!HTTP_DATE_HINT.test(value)) return null;
  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, (dateMs - Date.now()) / 1000);
}

function secondsFromMessage(message: string): number | null {
  const raw = RETRY_AFTER_MESSAGE_PATTERN.exec(message)?.[1];
  return raw === undefined ? null : Number(raw);
}

/** Reads the server's requested wait from a `Retry-After` header value (delta-seconds or
 * HTTP-date), falling back to the "Retry after Ns" text the API puts in its 429 message when the
 * header is absent or unusable. Returns `null` when neither is present. A little jitter is added
 * so clients released by the same rate-limit window don't all retry in lockstep; the result is
 * capped so a bad value can't stall retries indefinitely. */
export function parseRetryAfterMs(header: string | null, message: string): number | null {
  const seconds = secondsFromHeader(header) ?? secondsFromMessage(message);
  if (seconds === null || !Number.isFinite(seconds)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, seconds * 1000 + Math.random() * RETRY_AFTER_JITTER_MS);
}
