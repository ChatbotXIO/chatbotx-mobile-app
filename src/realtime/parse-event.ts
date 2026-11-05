import { RealtimeEventType, type RealtimeEventData } from './events';

/**
 * Hand-rolled runtime type guards for every `RealtimeEventData` variant in events.ts — no zod
 * dependency in this project, so each event shape is validated by hand.
 * `parseRealtimeEnvelope` classifies one envelope from a batch frame as ok / unknown / invalid;
 * unknown event types are skipped quietly, invalid ones trigger a resync in the provider.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** True when `value` is absent, `null`, or a string — the common shape for the optional
 * nullable-string fields scattered across these event payloads. */
function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function validateMessageCreated(data: unknown): data is { data: unknown } {
  // The source package deliberately keeps this payload untyped (see events.ts comment) — any
  // object-or-not value is "valid" at this layer; downstream `narrowIncomingMessage` in
  // apply-message-events.ts does the real per-field narrowing before it touches the cache.
  return data !== undefined;
}

function validateMessageDeleted(data: unknown): boolean {
  return isObject(data) && isStringArray(data.messageIds);
}

function validateMessageIdAssigned(data: unknown): boolean {
  return isObject(data) && isString(data.messageId) && isString(data.commentId);
}

function validateMessageUpdated(data: unknown): boolean {
  if (!isObject(data)) return false;
  if (!isString(data.messageId) || !isString(data.newText)) return false;
  if (!isOptionalNullableString(data.newAttachmentPath)) return false;
  if (!isOptionalNullableString(data.newAttachmentPublicUrl)) return false;
  if (!isOptionalNullableString(data.newAttachmentMimeType)) return false;
  if (data.newAttachmentWidth !== undefined && typeof data.newAttachmentWidth !== 'number')
    return false;
  if (data.newAttachmentHeight !== undefined && typeof data.newAttachmentHeight !== 'number')
    return false;
  if (data.removedAttachment !== undefined && typeof data.removedAttachment !== 'boolean')
    return false;
  return true;
}

function validateMessageFailed(data: unknown): boolean {
  if (!isObject(data)) return false;
  if (!isString(data.messageId)) return false;
  if (data.clientId !== undefined && typeof data.clientId !== 'string') return false;
  // `error` is optional — a payload that omits it entirely (rather than sending `null`) must not
  // fail validation and drop the whole event.
  if (!isOptionalNullableString(data.error)) return false;
  return true;
}

function validateTyping(data: unknown): boolean {
  return (
    isObject(data) &&
    isString(data.conversationId) &&
    typeof data.typing === 'boolean' &&
    typeof data.seconds === 'number'
  );
}

function validateContactCommon(data: unknown): boolean {
  return isObject(data) && isString(data.contactId);
}

function validateConversationAssigned(data: unknown): boolean {
  if (!isObject(data)) return false;
  if (!isStringArray(data.conversationIds)) return false;
  if (typeof data.assignedUserId !== 'string' && data.assignedUserId !== null) return false;
  if (typeof data.assignedInboxTeamId !== 'string' && data.assignedInboxTeamId !== null)
    return false;
  return true;
}

function validateConversationUpdatedChanges(changes: unknown): boolean {
  if (!isObject(changes)) return false;
  if (!isOptionalNullableString(changes.archivedAt)) return false;
  if (!isOptionalNullableString(changes.assignedUserId)) return false;
  if (!isOptionalNullableString(changes.assignedInboxTeamId)) return false;
  if (changes.followed !== undefined && typeof changes.followed !== 'boolean') return false;
  if (!isOptionalNullableString(changes.agentLastReadAt)) return false;
  if (changes.botEnabled !== undefined && typeof changes.botEnabled !== 'boolean') return false;
  return true;
}

function validateConversationUpdated(data: unknown): boolean {
  return (
    isObject(data) &&
    isStringArray(data.conversationIds) &&
    validateConversationUpdatedChanges(data.changes)
  );
}

const EVENT_VALIDATORS: Record<string, (data: unknown) => boolean> = {
  [RealtimeEventType.messageCreated]: validateMessageCreated,
  [RealtimeEventType.messageDeleted]: validateMessageDeleted,
  [RealtimeEventType.messageIdAssigned]: validateMessageIdAssigned,
  [RealtimeEventType.messageUpdated]: validateMessageUpdated,
  [RealtimeEventType.messageFailed]: validateMessageFailed,
  [RealtimeEventType.typing]: validateTyping,
  [RealtimeEventType.contactBlocked]: validateContactCommon,
  [RealtimeEventType.contactUnblocked]: validateContactCommon,
  [RealtimeEventType.conversationAssigned]: validateConversationAssigned,
  [RealtimeEventType.conversationUpdated]: validateConversationUpdated,
};

export type RealtimeEnvelopeResult =
  | { status: 'ok'; event: RealtimeEventData }
  /** Well-formed envelope for an event type this app doesn't handle (the protocol carries many
   * more types than mobile uses) — skipped silently, never a reason to resync. */
  | { status: 'unknown' }
  /** Not an envelope at all, or a handled event type whose `data` fails validation. */
  | { status: 'invalid' };

/** True when `value` has the `{ eventType: string, data? }` envelope shape. */
export function isRealtimeEnvelope(value: unknown): value is Record<string, unknown> {
  return isObject(value) && typeof value.eventType === 'string';
}

/** Classifies one already-JSON-parsed envelope from a batch frame. Never throws. */
export function parseRealtimeEnvelope(envelope: unknown): RealtimeEnvelopeResult {
  if (!isRealtimeEnvelope(envelope)) return { status: 'invalid' };

  const validate = EVENT_VALIDATORS[envelope.eventType as string];
  if (!validate) return { status: 'unknown' };

  return validate(envelope.data)
    ? { status: 'ok', event: envelope as unknown as RealtimeEventData }
    : { status: 'invalid' };
}

/** Parses and validates a raw JSON text payload holding ONE envelope into a `RealtimeEventData`,
 * or `null` if it is malformed, unhandled, or fails validation. Never throws. */
export function parseRealtimeEvent(raw: string): RealtimeEventData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = parseRealtimeEnvelope(parsed);
  return result.status === 'ok' ? result.event : null;
}
