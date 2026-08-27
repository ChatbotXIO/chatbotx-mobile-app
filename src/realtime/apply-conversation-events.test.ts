import {
  applyConversationAssigned,
  applyConversationMessageCreated,
  applyConversationUpdated,
  applyContactBlockState,
  applyContactDetailBlockState,
  type InfiniteConversationsData,
} from './apply-conversation-events';
import { RealtimeEventType } from './events';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import type { Message } from '@/features/chat/api/use-messages-infinite';

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    botEnabled: true,
    botResumeAt: null,
    archivedAt: null,
    additionalAttributes: null,
    contactLastReadAt: null,
    agentLastReadAt: null,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    followed: false,
    workspaceId: 'ws-1',
    contactId: 'contact-1',
    sourceId: null,
    lastStep: null,
    currentStep: null,
    adminRepliedAt: null,
    contactRepliedAt: null,
    contactInboxes: [],
    messages: [],
    contact: null,
    assignedUser: null,
    assignedInboxTeam: null,
    ...overrides,
  } as unknown as ConversationListItem;
}

function cacheWith(conversations: ConversationListItem[]): InfiniteConversationsData {
  return {
    pages: [{ data: conversations, nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  } as InfiniteConversationsData;
}

function firstPage(result: InfiniteConversationsData): ConversationListItem[] {
  return result!.pages[0]!.data;
}

function createdEvent(data: unknown) {
  return { eventType: RealtimeEventType.messageCreated, data } as const;
}

describe('applyConversationAssigned', () => {
  it('patches assignedUserId/assignedInboxTeamId on matching rows only', () => {
    const cache = cacheWith([
      fakeConversation({ id: 'conv-1', assignedUserId: null }),
      fakeConversation({ id: 'conv-2', assignedUserId: null }),
    ]);
    const result = applyConversationAssigned(cache, {
      eventType: RealtimeEventType.conversationAssigned,
      data: { conversationIds: ['conv-1'], assignedUserId: 'user-9', assignedInboxTeamId: null },
    });

    const data = firstPage(result);
    expect(data.find((c) => c.id === 'conv-1')?.assignedUserId).toBe('user-9');
    expect(data.find((c) => c.id === 'conv-2')?.assignedUserId).toBeNull();
  });
});

describe('applyConversationUpdated', () => {
  it('applies the changes object to matching rows', () => {
    const cache = cacheWith([fakeConversation({ id: 'conv-1', botEnabled: true })]);
    const result = applyConversationUpdated(cache, {
      eventType: RealtimeEventType.conversationUpdated,
      data: { conversationIds: ['conv-1'], changes: { botEnabled: false } },
    });

    expect(firstPage(result)[0]!.botEnabled).toBe(false);
  });
});

describe('applyContactBlockState', () => {
  it('patches the embedded contact.blockedAt for matching contactId rows', () => {
    const cache = cacheWith([
      fakeConversation({
        id: 'conv-1',
        contactId: 'contact-1',
        contact: { blockedAt: null } as never,
      }),
    ]);
    const result = applyContactBlockState(
      cache,
      { eventType: RealtimeEventType.contactBlocked, data: { contactId: 'contact-1' } },
      true,
    );

    expect(firstPage(result)[0]!.contact?.blockedAt).not.toBeNull();
  });
});

describe('applyContactDetailBlockState', () => {
  it('sets blockedAt when blocked', () => {
    const result = applyContactDetailBlockState({ blockedAt: null }, true);
    expect(result?.blockedAt).not.toBeNull();
  });

  it('clears blockedAt when unblocked', () => {
    const result = applyContactDetailBlockState({ blockedAt: '2026-01-01T00:00:00.000Z' }, false);
    expect(result?.blockedAt).toBeNull();
  });

  it('returns undefined unchanged when nothing is cached', () => {
    expect(applyContactDetailBlockState(undefined, true)).toBeUndefined();
  });
});

describe('applyConversationMessageCreated', () => {
  it('patches lastActivityAt and appends to the messages preview array on the matching row', () => {
    const cache = cacheWith([
      fakeConversation({
        id: 'conv-1',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
        messages: [{ id: 'old-msg', text: 'hi' } as Message],
      }),
    ]);

    const result = applyConversationMessageCreated(
      cache,
      createdEvent({
        id: 'new-msg',
        conversationId: 'conv-1',
        createdAt: '2026-01-02T00:00:00.000Z',
        text: 'new message',
        attachments: [],
      }),
    );

    expect(result.found).toBe(true);
    const row = firstPage(result.data)[0]!;
    expect(row.lastActivityAt).toBe('2026-01-02T00:00:00.000Z');
    expect(row.messages.map((m) => m.id)).toEqual(['old-msg', 'new-msg']);
  });

  it('moves the patched row to the top of its page', () => {
    const cache = cacheWith([
      fakeConversation({ id: 'conv-1', messages: [] }),
      fakeConversation({ id: 'conv-2', messages: [] }),
      fakeConversation({ id: 'conv-3', messages: [] }),
    ]);

    const result = applyConversationMessageCreated(
      cache,
      createdEvent({
        id: 'new-msg',
        conversationId: 'conv-3',
        createdAt: '2026-01-02T00:00:00.000Z',
        attachments: [],
      }),
    );

    expect(firstPage(result.data).map((c) => c.id)).toEqual(['conv-3', 'conv-1', 'conv-2']);
  });

  it('reports found=false and leaves the cache unchanged when the conversation is not cached', () => {
    const cache = cacheWith([fakeConversation({ id: 'conv-1' })]);

    const result = applyConversationMessageCreated(
      cache,
      createdEvent({
        id: 'new-msg',
        conversationId: 'not-cached',
        createdAt: '2026-01-02T00:00:00.000Z',
        attachments: [],
      }),
    );

    expect(result.found).toBe(false);
    expect(firstPage(result.data).map((c) => c.id)).toEqual(['conv-1']);
  });

  it('reports found=false when there is nothing cached at all', () => {
    const result = applyConversationMessageCreated(undefined, createdEvent({ id: 'm1' }));
    expect(result.found).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it('reports found=false for a malformed/un-narrowable payload', () => {
    const cache = cacheWith([fakeConversation({ id: 'conv-1' })]);
    const result = applyConversationMessageCreated(cache, createdEvent(null));
    expect(result.found).toBe(false);
    expect(result.data).toBe(cache);
  });

  it('caps the preview messages array at the max length', () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({ id: `msg-${i}` }) as Message);
    const cache = cacheWith([fakeConversation({ id: 'conv-1', messages: existing })]);

    const result = applyConversationMessageCreated(
      cache,
      createdEvent({
        id: 'new-msg',
        conversationId: 'conv-1',
        createdAt: '2026-01-02T00:00:00.000Z',
        attachments: [],
      }),
    );

    const row = firstPage(result.data)[0]!;
    expect(row.messages).toHaveLength(20);
    expect(row.messages[row.messages.length - 1]!.id).toBe('new-msg');
    expect(row.messages[0]!.id).toBe('msg-1');
  });
});
