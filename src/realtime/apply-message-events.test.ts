import { applyMessageCreated, type InfiniteMessagesData } from '@/realtime/apply-message-events';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { RealtimeEventType } from '@/realtime/events';

function cacheWith(messages: Partial<Message>[]): InfiniteMessagesData {
  return {
    pages: [{ data: messages as Message[], nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  } as InfiniteMessagesData;
}

function createdEvent(data: unknown) {
  return { eventType: RealtimeEventType.messageCreated, data } as const;
}

function firstPage(result: InfiniteMessagesData): Message[] {
  return result!.pages[0]!.data;
}

const CONVERSATION_A = 'conv-a';
const CONVERSATION_B = 'conv-b';

describe('applyMessageCreated', () => {
  it('defaults a missing attachments field to an empty array', () => {
    // A wire payload without `attachments` would otherwise land in the cache and crash
    // message-bubble.tsx on `message.attachments.length` — the same bug as the optimistic entry,
    // reached from the websocket side instead.
    const result = applyMessageCreated(
      cacheWith([]),
      createdEvent({ id: 'srv-1', text: 'hi', conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result)[0].attachments).toEqual([]);
  });

  it('passes existing attachments through untouched', () => {
    const attachments = [{ id: 'att-1', fileType: 'image', url: 'https://cdn/x.jpg' }];
    const result = applyMessageCreated(
      cacheWith([]),
      createdEvent({ id: 'srv-1', text: 'hi', attachments, conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result)[0].attachments).toEqual(attachments);
  });

  it('ignores a payload with no usable id', () => {
    const cache = cacheWith([{ id: 'existing' }]);

    expect(applyMessageCreated(cache, createdEvent({ text: 'no id' }), CONVERSATION_A)).toBe(cache);
    expect(applyMessageCreated(cache, createdEvent(null), CONVERSATION_A)).toBe(cache);
  });

  it('replaces a pending optimistic entry that shares the clientId', () => {
    const cache = cacheWith([{ id: 'optimistic-99', clientId: '99', text: 'pending' }]);

    const result = applyMessageCreated(
      cache,
      createdEvent({
        id: 'srv-1',
        clientId: '99',
        text: 'confirmed',
        attachments: [],
        conversationId: CONVERSATION_A,
      }),
      CONVERSATION_A,
    );

    const data = firstPage(result);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('srv-1');
    expect(data[0].text).toBe('confirmed');
  });

  it('prepends a message that is not already cached', () => {
    const result = applyMessageCreated(
      cacheWith([{ id: 'older' }]),
      createdEvent({ id: 'srv-1', attachments: [], conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result).map((message) => message.id)).toEqual(['srv-1', 'older']);
  });

  it('does not duplicate a message already present by id', () => {
    const result = applyMessageCreated(
      cacheWith([{ id: 'srv-1' }]),
      createdEvent({ id: 'srv-1', attachments: [], conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result)).toHaveLength(1);
  });

  it('no-ops when the incoming message belongs to a different conversation (cross-conversation leak guard)', () => {
    const cache = cacheWith([{ id: 'existing-b' }]);

    const result = applyMessageCreated(
      cache,
      createdEvent({ id: 'srv-from-a', attachments: [], conversationId: CONVERSATION_A }),
      CONVERSATION_B,
    );

    expect(result).toBe(cache);
    expect(firstPage(result).map((message) => message.id)).toEqual(['existing-b']);
  });

  it('applies when the incoming message conversationId matches the target', () => {
    const cache = cacheWith([{ id: 'existing-a' }]);

    const result = applyMessageCreated(
      cache,
      createdEvent({ id: 'srv-from-a', attachments: [], conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result).map((message) => message.id)).toEqual(['srv-from-a', 'existing-a']);
  });
});
