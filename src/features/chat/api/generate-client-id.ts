/**
 * The backend's message-create `clientId` field is typed `zodBigintAsString()` server-side (not a
 * free-form UUID) — confirmed by the generated schema also carrying `clientId?: string` on message
 * resources themselves. A UUID would fail that validation. This generates a timestamp-prefixed
 * pseudo-snowflake: always a valid numeric string, and — since it's only ever compared within one
 * client's own pending-sends map for the lifetime of the app process — collision odds are
 * negligible without needing real snowflake machinery.
 */
export function generateClientId(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${timestamp}${random}`;
}
