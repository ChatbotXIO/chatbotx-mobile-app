import { parseRealtimeEvent } from './parse-event';
import { RealtimeEventType } from './events';

describe('parseRealtimeEvent', () => {
  describe('malformed input', () => {
    it('returns null for garbage (non-JSON) text', () => {
      expect(parseRealtimeEvent('not json{{')).toBeNull();
    });

    it('returns null for a JSON value that is not an object', () => {
      expect(parseRealtimeEvent('42')).toBeNull();
      expect(parseRealtimeEvent('"a string"')).toBeNull();
      expect(parseRealtimeEvent('[1,2,3]')).toBeNull();
      expect(parseRealtimeEvent('null')).toBeNull();
    });

    it('returns null when eventType is missing', () => {
      expect(parseRealtimeEvent(JSON.stringify({ data: {} }))).toBeNull();
    });

    it('returns null when eventType is not a recognized value', () => {
      expect(parseRealtimeEvent(JSON.stringify({ eventType: 'bogusEvent', data: {} }))).toBeNull();
    });

    it('returns null when eventType is not a string', () => {
      expect(parseRealtimeEvent(JSON.stringify({ eventType: 123, data: {} }))).toBeNull();
    });
  });

  describe('messageCreated', () => {
    it('accepts any present data payload (untyped by design)', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageCreated,
        data: { id: 'm1', text: 'hi' },
      });
      const result = parseRealtimeEvent(raw);
      expect(result?.eventType).toBe(RealtimeEventType.messageCreated);
    });
  });

  describe('messageDeleted', () => {
    it('accepts a valid messageIds array', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageDeleted,
        data: { messageIds: ['a', 'b'] },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a non-array messageIds', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageDeleted,
        data: { messageIds: 'a' },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });

    it('rejects a messageIds array with non-string elements', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageDeleted,
        data: { messageIds: [1, 2] },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('messageIdAssigned', () => {
    it('accepts a valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageIdAssigned,
        data: { messageId: 'm1', commentId: 'c1' },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a missing commentId', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageIdAssigned,
        data: { messageId: 'm1' },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('messageUpdated', () => {
    it('accepts a minimal valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageUpdated,
        data: { messageId: 'm1', newText: 'edited' },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('accepts a full payload with optional attachment fields', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageUpdated,
        data: {
          messageId: 'm1',
          newText: 'edited',
          newAttachmentPath: 'path.jpg',
          newAttachmentPublicUrl: 'https://x/y.jpg',
          newAttachmentMimeType: 'image/jpeg',
          newAttachmentWidth: 100,
          newAttachmentHeight: 200,
          removedAttachment: false,
        },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a wrong-typed newText', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageUpdated,
        data: { messageId: 'm1', newText: 123 },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });

    it('rejects a wrong-typed newAttachmentWidth', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageUpdated,
        data: { messageId: 'm1', newText: 'x', newAttachmentWidth: 'wide' },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('messageFailed', () => {
    it('accepts a valid payload with a null error', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageFailed,
        data: { messageId: 'm1', error: null },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('accepts an optional clientId', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageFailed,
        data: { messageId: 'm1', clientId: 'c1', error: 'boom' },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a missing messageId', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.messageFailed,
        data: { error: null },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('typing', () => {
    it('accepts a valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.typing,
        data: { conversationId: 'c1', typing: true, seconds: 5 },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a missing seconds field', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.typing,
        data: { conversationId: 'c1', typing: true },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });

    it('rejects a non-boolean typing field', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.typing,
        data: { conversationId: 'c1', typing: 'yes', seconds: 5 },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('contactBlocked / contactUnblocked', () => {
    it('accepts a valid payload for both types', () => {
      expect(
        parseRealtimeEvent(
          JSON.stringify({
            eventType: RealtimeEventType.contactBlocked,
            data: { contactId: 'c1' },
          }),
        ),
      ).not.toBeNull();
      expect(
        parseRealtimeEvent(
          JSON.stringify({
            eventType: RealtimeEventType.contactUnblocked,
            data: { contactId: 'c1' },
          }),
        ),
      ).not.toBeNull();
    });

    it('rejects a missing contactId', () => {
      const raw = JSON.stringify({ eventType: RealtimeEventType.contactBlocked, data: {} });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('conversationAssigned', () => {
    it('accepts a valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationAssigned,
        data: { conversationIds: ['c1'], assignedUserId: 'u1', assignedInboxTeamId: null },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a non-array conversationIds', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationAssigned,
        data: { conversationIds: 'c1', assignedUserId: null, assignedInboxTeamId: null },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('notifyExportResult', () => {
    it('accepts a valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.notifyExportResult,
        data: { outputPath: '/out.csv', status: 'completed' },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects an invalid status value', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.notifyExportResult,
        data: { outputPath: '/out.csv', status: 'bogus' },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });

  describe('conversationCreated', () => {
    it('accepts any present data payload (untyped by design)', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationCreated,
        data: { id: 'conv1' },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });
  });

  describe('conversationUpdated', () => {
    it('accepts a valid payload', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationUpdated,
        data: { conversationIds: ['c1'], changes: { botEnabled: true, followed: false } },
      });
      expect(parseRealtimeEvent(raw)).not.toBeNull();
    });

    it('rejects a missing changes object', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationUpdated,
        data: { conversationIds: ['c1'] },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });

    it('rejects a wrong-typed field inside changes', () => {
      const raw = JSON.stringify({
        eventType: RealtimeEventType.conversationUpdated,
        data: { conversationIds: ['c1'], changes: { botEnabled: 'yes' } },
      });
      expect(parseRealtimeEvent(raw)).toBeNull();
    });
  });
});
