import {
  applyMessageContentUpdated,
  applyMessageCreated,
  reconcileSentMessage,
  applyMessageFailed,
  applyMessageRemoved,
  type InfiniteMessagesData,
} from '@/realtime/apply-message-events';
import { DELIVERY_FAILED_ERROR_KIND } from '@/features/chat/lib/send-status';
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

describe('applyMessageFailed', () => {
  function failedEvent(data: { messageId: string; clientId?: string; error?: string | null }) {
    return { eventType: RealtimeEventType.messageFailed, data } as const;
  }

  it('treats error: null as the channel accepting the send, not as a failure', () => {
    const result = applyMessageFailed(
      cacheWith([{ id: 'srv-1', clientId: 'c-1', sendError: null }]),
      failedEvent({ messageId: 'srv-1', clientId: 'c-1', error: null }),
    );

    expect(firstPage(result)[0]).toEqual({ id: 'srv-1', clientId: 'c-1', sendError: null });
  });

  it('clears the pending state of a local row the channel accepted', () => {
    const result = applyMessageFailed(
      cacheWith([{ id: 'tmp', clientId: 'c-1', __optimisticStatus: 'pending' } as never]),
      failedEvent({ messageId: 'srv-1', clientId: 'c-1', error: null }),
    );

    expect(firstPage(result)[0]).toEqual({ id: 'tmp', clientId: 'c-1', sendError: null });
  });

  it('matches by messageId when the event carries a clientId the cached row lacks', () => {
    const result = applyMessageFailed(
      cacheWith([{ id: 'srv-1' }]),
      failedEvent({ messageId: 'srv-1', clientId: 'c-other', error: 'rejected' }),
    );

    expect(firstPage(result)[0]?.sendError).toBe('rejected');
  });

  it('writes the channel error onto the row', () => {
    const result = applyMessageFailed(
      cacheWith([{ id: 'srv-1' }, { id: 'srv-2' }]),
      failedEvent({ messageId: 'srv-1', error: 'Outside of allowed window' }),
    );

    expect(firstPage(result).map((m) => m.sendError)).toEqual([
      'Outside of allowed window',
      undefined,
    ]);
  });
});

describe('applyMessageRemoved', () => {
  const removedEvent = (messageIds: string[]) =>
    ({ eventType: RealtimeEventType.messageRemoved, data: { messageIds } }) as const;

  it('drops removed rows this device did not send', () => {
    const result = applyMessageRemoved(
      cacheWith([{ id: 'srv-1' }, { id: 'srv-2' }]),
      removedEvent(['srv-1']),
      new Map(),
    );

    expect(firstPage(result).map((m) => m.id)).toEqual(['srv-2']);
  });

  it('keeps an own send as a retryable failed row instead of dropping it', () => {
    const result = applyMessageRemoved(
      cacheWith([{ id: 'tmp', clientId: 'c-1', text: 'hello' }]),
      removedEvent(['srv-1']),
      new Map([['srv-1', 'c-1']]),
    );

    expect(firstPage(result)[0]).toMatchObject({
      clientId: 'c-1',
      text: 'hello',
      __optimisticStatus: 'failed',
      __optimisticError: DELIVERY_FAILED_ERROR_KIND,
    });
  });
});

describe('applyMessageRemoved — server copy of an own send', () => {
  it('keeps a refetched server row of an own send as failed and restores its clientId', () => {
    const result = applyMessageRemoved(
      cacheWith([{ id: 'srv-1', text: 'hello' }]),
      { eventType: RealtimeEventType.messageRemoved, data: { messageIds: ['srv-1'] } },
      new Map([['srv-1', 'c-1']]),
    );

    expect(firstPage(result)[0]).toMatchObject({
      id: 'srv-1',
      clientId: 'c-1',
      __optimisticStatus: 'failed',
    });
  });
});

describe('applyMessageCreated — ordering and duplicates', () => {
  it('inserts an out-of-order message at its createdAt position', () => {
    const result = applyMessageCreated(
      cacheWith([
        { id: 'm-3', createdAt: '2026-11-26T10:03:00.000Z' },
        { id: 'm-1', createdAt: '2026-11-26T10:01:00.000Z' },
      ]),
      createdEvent({
        id: 'm-2',
        createdAt: '2026-11-26T10:02:00.000Z',
        conversationId: CONVERSATION_A,
      }),
      CONVERSATION_A,
    );

    expect(firstPage(result).map((m) => m.id)).toEqual(['m-3', 'm-2', 'm-1']);
  });

  it('does not duplicate a message already cached on an older page', () => {
    const cache = {
      pages: [
        { data: [{ id: 'new' }], nextCursor: 'x', prevCursor: null },
        { data: [{ id: 'srv-1' }], nextCursor: null, prevCursor: null },
      ],
      pageParams: [undefined, 'x'],
    } as unknown as InfiniteMessagesData;

    const result = applyMessageCreated(
      cache,
      createdEvent({ id: 'srv-1', conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(result).toBe(cache);
  });

  it('leaves one row when the event arrives after a refetch already added the server row', () => {
    // The create response gave the local row its server id; a refetch then returned the same
    // server row. The late messageCreated must collapse them into a single row.
    const result = applyMessageCreated(
      cacheWith([{ id: 'srv-1', clientId: 'c-1' }, { id: 'srv-1' }]),
      createdEvent({ id: 'srv-1', clientId: 'c-1', text: 'hi', conversationId: CONVERSATION_A }),
      CONVERSATION_A,
    );

    expect(firstPage(result)).toEqual([
      expect.objectContaining({ id: 'srv-1', clientId: 'c-1', text: 'hi' }),
    ]);
  });
});

describe('reconcileSentMessage', () => {
  it('gives the local row its server id and clears its pending state', () => {
    const result = reconcileSentMessage(
      cacheWith([
        { id: 'optimistic-c-1', clientId: 'c-1', __optimisticStatus: 'pending' } as never,
      ]),
      'c-1',
      'srv-1',
    );

    expect(firstPage(result)).toEqual([{ id: 'srv-1', clientId: 'c-1' }]);
  });

  it('merges into a server row that a refetch already landed', () => {
    const result = reconcileSentMessage(
      cacheWith([
        { id: 'optimistic-c-1', clientId: 'c-1', __optimisticStatus: 'pending' } as never,
        { id: 'srv-1', text: 'hi' },
      ]),
      'c-1',
      'srv-1',
    );

    expect(firstPage(result)).toEqual([{ id: 'srv-1', text: 'hi', clientId: 'c-1' }]);
  });

  it('no-ops when the local row is gone', () => {
    const cache = cacheWith([{ id: 'srv-9' }]);
    expect(reconcileSentMessage(cache, 'c-1', 'srv-1')).toBe(cache);
  });
});

describe('applyMessageContentUpdated', () => {
  it('replaces contentAttributes of the matching message only', () => {
    const result = applyMessageContentUpdated(
      cacheWith([
        { id: 'm-1', contentAttributes: { old: true } as never },
        { id: 'm-2', contentAttributes: null },
      ]),
      {
        eventType: RealtimeEventType.messageContentUpdated,
        data: { messageId: 'm-1', contentAttributes: { transcript: 'hello' } },
      },
    );

    expect(firstPage(result).map((m) => m.contentAttributes)).toEqual([
      { transcript: 'hello' },
      null,
    ]);
  });
});
