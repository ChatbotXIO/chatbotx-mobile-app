import type { Message } from '@/features/chat/api/use-messages-infinite';

import { computeMessageGroups } from './message-groups';

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    contactInboxId: '',
    text: 'hello',
    contentAttributes: null,
    messageType: 'outgoing',
    contentType: 'text',
    senderType: 'user',
    sourceId: null,
    deletedAt: null,
    type: 'message',
    parentId: null,
    attributes: null,
    sendError: null,
    attachments: [],
    ...overrides,
  } as unknown as Message;
}

describe('computeMessageGroups', () => {
  it('marks a single isolated message as "single"', () => {
    const messages = [fakeMessage({ id: 'a' })];

    const groups = computeMessageGroups(messages);

    expect(groups).toEqual([{ position: 'single', showMeta: true }]);
  });

  it('groups consecutive same-sender messages within the time window', () => {
    const messages = [
      fakeMessage({ id: 'a', senderType: 'user', createdAt: '2026-01-01T00:00:00.000Z' }),
      fakeMessage({ id: 'b', senderType: 'user', createdAt: '2026-01-01T00:01:00.000Z' }),
      fakeMessage({ id: 'c', senderType: 'user', createdAt: '2026-01-01T00:02:00.000Z' }),
    ];

    const groups = computeMessageGroups(messages);

    expect(groups.map((g) => g.position)).toEqual(['first', 'middle', 'last']);
    expect(groups.map((g) => g.showMeta)).toEqual([true, false, false]);
  });

  it('breaks the group when the sender changes', () => {
    const messages = [
      fakeMessage({ id: 'a', senderType: 'user', createdAt: '2026-01-01T00:00:00.000Z' }),
      fakeMessage({ id: 'b', senderType: 'contact', createdAt: '2026-01-01T00:00:30.000Z' }),
    ];

    const groups = computeMessageGroups(messages);

    expect(groups.map((g) => g.position)).toEqual(['single', 'single']);
  });

  it('breaks the group when messages are more than 5 minutes apart', () => {
    const messages = [
      fakeMessage({ id: 'a', senderType: 'user', createdAt: '2026-01-01T00:00:00.000Z' }),
      fakeMessage({ id: 'b', senderType: 'user', createdAt: '2026-01-01T00:06:00.000Z' }),
    ];

    const groups = computeMessageGroups(messages);

    expect(groups.map((g) => g.position)).toEqual(['single', 'single']);
  });

  it('never groups activity or system messages with neighbors', () => {
    const messages = [
      fakeMessage({ id: 'a', senderType: 'user', createdAt: '2026-01-01T00:00:00.000Z' }),
      fakeMessage({
        id: 'b',
        senderType: 'system',
        messageType: 'activity',
        createdAt: '2026-01-01T00:00:10.000Z',
      }),
      fakeMessage({ id: 'c', senderType: 'user', createdAt: '2026-01-01T00:00:20.000Z' }),
    ];

    const groups = computeMessageGroups(messages);

    expect(groups.map((g) => g.position)).toEqual(['single', 'single', 'single']);
  });

  it('returns an empty array for an empty input', () => {
    expect(computeMessageGroups([])).toEqual([]);
  });
});
