/**
 * MIRRORED TYPES — mirrors the backend's realtime event schema (no shared package; this repo is
 * standalone, so there is no live cross-repo import). Only the event types the app handles are
 * listed; any other event type on the wire is skipped by `parse-event.ts`.
 *
 * Deliberately not handled: `messageTranslationUpdated` (the app has no translation UI) and
 * `contactInboxThreadControlUpdated` (no handover / thread-control UI).
 *
 * When the backend's event schema changes, re-copy the relevant `RealtimeEvent*` types here.
 * Last synced 2026-11-02 against the realtime v2 protocol.
 */

export const RealtimeEventType = {
  messageCreated: 'messageCreated',
  messageDeleted: 'messageDeleted',
  messageUpdated: 'messageUpdated',
  messageIdAssigned: 'messageIdAssigned',
  messageFailed: 'messageFailed',
  messageRemoved: 'messageRemoved',
  messageContentUpdated: 'messageContentUpdated',
  typing: 'typing',
  contactBlocked: 'contactBlocked',
  contactUnblocked: 'contactUnblocked',
  conversationAssigned: 'conversationAssigned',
  conversationUpdated: 'conversationUpdated',
} as const;

export type RealtimeEventCreateMessage = {
  eventType: typeof RealtimeEventType.messageCreated;
  data: unknown;
};

/** Per-event routing hint attached by the server; the app never reads it. */
export interface RealtimeEventRoute {
  [key: string]: unknown;
}

export type RealtimeEventMessageDeleted = {
  eventType: typeof RealtimeEventType.messageDeleted;
  data: {
    messageIds: string[];
  };
};

/** Messages removed from the conversation for good — an outgoing message whose send failed and
 * that was not kept with an error (every public-API send, which is what this app uses). Unlike
 * `messageDeleted` there is no tombstone: the rows leave the timeline. */
export type RealtimeEventMessageRemoved = {
  eventType: typeof RealtimeEventType.messageRemoved;
  data: {
    messageIds: string[];
  };
};

export type RealtimeEventMessageIdAssigned = {
  eventType: typeof RealtimeEventType.messageIdAssigned;
  data: {
    messageId: string;
    commentId: string;
  };
};

export type RealtimeEventMessageUpdated = {
  eventType: typeof RealtimeEventType.messageUpdated;
  data: {
    messageId: string;
    newText: string;
    newAttachmentPath?: string | null;
    newAttachmentPublicUrl?: string | null;
    newAttachmentMimeType?: string | null;
    newAttachmentWidth?: number;
    newAttachmentHeight?: number;
    removedAttachment?: boolean;
  };
};

/** A message's structured payload was enriched after it was created (e.g. a call transcript).
 * Carries the complete `contentAttributes`, not a patch. */
export type RealtimeEventMessageContentUpdated = {
  eventType: typeof RealtimeEventType.messageContentUpdated;
  data: {
    messageId: string;
    contentAttributes: Record<string, unknown>;
  };
};

export type RealtimeEventMessageFailed = {
  eventType: typeof RealtimeEventType.messageFailed;
  data: {
    messageId: string;
    clientId?: string;
    error?: string | null;
  };
};

export type RealtimeEventTyping = {
  eventType: typeof RealtimeEventType.typing;
  data: {
    conversationId: string;
    typing: boolean;
    seconds: number;
  };
};

export type RealtimeEventContactCommon = {
  eventType: typeof RealtimeEventType.contactBlocked | typeof RealtimeEventType.contactUnblocked;
  data: {
    contactId: string;
  };
};

export type RealtimeEventConversationAssigned = {
  eventType: typeof RealtimeEventType.conversationAssigned;
  data: {
    conversationIds: string[];
    assignedUserId: string | null;
    assignedInboxTeamId: string | null;
  };
};

export type RealtimeEventConversationUpdatedChanges = {
  archivedAt?: string | null;
  assignedUserId?: string | null;
  assignedInboxTeamId?: string | null;
  followed?: boolean;
  agentLastReadAt?: string | null;
  botEnabled?: boolean;
};

export type RealtimeEventConversationUpdated = {
  eventType: typeof RealtimeEventType.conversationUpdated;
  data: {
    conversationIds: string[];
    changes: RealtimeEventConversationUpdatedChanges;
  };
};

export type RealtimeEventData =
  | RealtimeEventCreateMessage
  | RealtimeEventMessageDeleted
  | RealtimeEventMessageIdAssigned
  | RealtimeEventMessageUpdated
  | RealtimeEventMessageFailed
  | RealtimeEventMessageRemoved
  | RealtimeEventMessageContentUpdated
  | RealtimeEventContactCommon
  | RealtimeEventConversationAssigned
  | RealtimeEventTyping
  | RealtimeEventConversationUpdated;
