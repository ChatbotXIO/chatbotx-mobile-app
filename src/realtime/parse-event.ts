import { RealtimeEventType, type RealtimeEventData } from './events';

/**
 * Hand-rolled runtime type guards for every `RealtimeEventData` variant in events.ts — no zod
 * dependency in this project (see AGENTS.md/plan), so each event shape is validated by hand.
 * `parseRealtimeEvent` is the single entry point: parses the raw websocket text, validates the
 * envelope (`eventType` + `data` object), then dispatches to the per-type guard. Returns `null`
 * on ANY malformation (invalid JSON, non-object, unrecognized eventType, wrong-shaped data)
 * rather than throwing — realtime-provider.tsx's onMessage handler is expected to `__DEV__ warn`
 * and drop the event rather than crash the socket handler.
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

const NOTIFY_EXPORT_STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);

function validateNotifyExportResult(data: unknown): boolean {
  if (!isObject(data)) return false;
  if (!isString(data.outputPath)) return false;
  if (!isString(data.status) || !NOTIFY_EXPORT_STATUSES.has(data.status)) return false;
  if (data.error !== undefined && typeof data.error !== 'string') return false;
  return true;
}

function validateConversationCreated(data: unknown): boolean {
  // Untyped payload by design (see events.ts) — any presence is "valid" here.
  return data !== undefined;
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

/** Parses and validates a raw websocket text payload into a `RealtimeEventData`, or `null` if the
 * payload is malformed JSON, not an object, missing/unrecognized `eventType`, or has a `data`
 * shape that doesn't match the event type. Never throws. */
export function parseRealtimeEvent(raw: string): RealtimeEventData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)) return null;
  const { eventType, data } = parsed;
  if (typeof eventType !== 'string') return null;

  switch (eventType) {
    case RealtimeEventType.messageCreated:
      return validateMessageCreated(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.messageDeleted:
      return validateMessageDeleted(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.messageIdAssigned:
      return validateMessageIdAssigned(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.messageUpdated:
      return validateMessageUpdated(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.messageFailed:
      return validateMessageFailed(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.typing:
      return validateTyping(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.contactBlocked:
    case RealtimeEventType.contactUnblocked:
      return validateContactCommon(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.conversationAssigned:
      return validateConversationAssigned(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.notifyExportResult:
      return validateNotifyExportResult(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.conversationCreated:
      return validateConversationCreated(data) ? (parsed as RealtimeEventData) : null;
    case RealtimeEventType.conversationUpdated:
      return validateConversationUpdated(data) ? (parsed as RealtimeEventData) : null;
    default:
      return null;
  }
}
