/**
 * MIRRORED TYPES — kept in manual sync with `aha.chat/packages/partysocket-config/src/schemas.ts`.
 *
 * This app lives in a separate git repo from aha.chat (not a pnpm workspace member), so there is
 * no live cross-repo import. Do NOT import aha.chat's `lib.ts` (server-side realtime wiring) —
 * only these type-only definitions, mirrored by hand.
 *
 * When the source file changes, re-copy its `RealtimeEventType` and `RealtimeEvent*` shapes here.
 * Last synced against aha.chat's current `packages/partysocket-config/src/schemas.ts` (Phase 5,
 * 2026-08-21) — added conversationCreated/conversationUpdated, per the plan's pre-flight note.
 */

export const RealtimeEventType = {
  messageCreated: 'messageCreated',
  messageDeleted: 'messageDeleted',
  messageUpdated: 'messageUpdated',
  messageIdAssigned: 'messageIdAssigned',
  messageFailed: 'messageFailed',
  typing: 'typing',
  contactBlocked: 'contactBlocked',
  contactUnblocked: 'contactUnblocked',
  conversationAssigned: 'conversationAssigned',
  notifyExportResult: 'notifyExportResult',
  conversationCreated: 'conversationCreated',
  conversationUpdated: 'conversationUpdated',
} as const;

export type RealtimeEventCreateMessage = {
  eventType: typeof RealtimeEventType.messageCreated;
  data: unknown;
};

export type RealtimeEventMessageDeleted = {
  eventType: typeof RealtimeEventType.messageDeleted;
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

export type RealtimeEventNotifyExportResult = {
  eventType: typeof RealtimeEventType.notifyExportResult;
  data: {
    outputPath: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  };
};

export type RealtimeEventConversationCreated = {
  eventType: typeof RealtimeEventType.conversationCreated;
  // Full conversation row — shape owned by @chatbotx.io/business's ConversationModel; kept as
  // `unknown` here to match the source package (avoids a dependency on the database schema).
  data: unknown;
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
  | RealtimeEventContactCommon
  | RealtimeEventConversationAssigned
  | RealtimeEventTyping
  | RealtimeEventNotifyExportResult
  | RealtimeEventConversationCreated
  | RealtimeEventConversationUpdated;
