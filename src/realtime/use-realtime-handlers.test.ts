import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { queryKeys } from '@/api/query-keys';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { RealtimeEventType } from './events';
import { useRealtimeHandlers } from './use-realtime-handlers';

const WORKSPACE_ID = 'ws-1';

function messagesCache(messages: Partial<Message>[]) {
  return {
    pages: [{ data: messages as Message[], nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  };
}

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-a',
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
    workspaceId: WORKSPACE_ID,
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

function conversationsCache(conversations: ConversationListItem[]) {
  return {
    pages: [{ data: conversations, nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  };
}

describe('useRealtimeHandlers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useChatStore.setState({ typingByConversation: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('routes messageCreated to only the matching conversation messages cache, leaving others untouched', async () => {
    const queryClient = new QueryClient();
    const keyA = queryKeys.ws.messages.list(WORKSPACE_ID, 'conv-a');
    const keyB = queryKeys.ws.messages.list(WORKSPACE_ID, 'conv-b');
    queryClient.setQueryData(keyA, messagesCache([{ id: 'existing-a' }]));
    queryClient.setQueryData(keyB, messagesCache([{ id: 'existing-b' }]));

    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.messageCreated,
      data: { id: 'new-msg', conversationId: 'conv-a', attachments: [] },
    });

    const dataA = queryClient.getQueryData<ReturnType<typeof messagesCache>>(keyA);
    const dataB = queryClient.getQueryData<ReturnType<typeof messagesCache>>(keyB);

    expect(dataA!.pages[0]!.data.map((m) => m.id)).toEqual(['new-msg', 'existing-a']);
    expect(dataB!.pages[0]!.data.map((m) => m.id)).toEqual(['existing-b']);
  });

  it('patches the conversations-list row for the matching conversation on messageCreated', async () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.ws.conversations.list(WORKSPACE_ID, {});
    queryClient.setQueryData(
      listKey,
      conversationsCache([fakeConversation({ id: 'conv-a', messages: [] })]),
    );

    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.messageCreated,
      data: {
        id: 'new-msg',
        conversationId: 'conv-a',
        createdAt: '2026-01-05T00:00:00.000Z',
        attachments: [],
      },
    });

    const data = queryClient.getQueryData<ReturnType<typeof conversationsCache>>(listKey);
    const row = data!.pages[0]!.data[0]!;
    expect(row.lastActivityAt).toBe('2026-01-05T00:00:00.000Z');
    expect(row.messages.map((m) => m.id)).toEqual(['new-msg']);
  });

  it('debounces an invalidation of the conversations list when the conversation is not cached', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const listKey = queryKeys.ws.conversations.list(WORKSPACE_ID, {});
    queryClient.setQueryData(
      listKey,
      conversationsCache([fakeConversation({ id: 'some-other-conv' })]),
    );

    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.messageCreated,
      data: { id: 'new-msg', conversationId: 'not-cached', attachments: [] },
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['ws', WORKSPACE_ID, 'conversations', 'list'] }),
    );
  });

  it('clears the typing flag automatically after the event TTL elapses', async () => {
    const queryClient = new QueryClient();
    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.typing,
      data: { conversationId: 'conv-a', typing: true, seconds: 1 },
    });

    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(true);

    jest.advanceTimersByTime(1000);

    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(false);
  });

  it('does not clear typing early when an explicit typing:false event has not arrived', async () => {
    const queryClient = new QueryClient();
    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.typing,
      data: { conversationId: 'conv-a', typing: true, seconds: 5 },
    });

    jest.advanceTimersByTime(4000);
    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(true);
  });

  it('clears the timer when an explicit typing:false event arrives before the TTL', async () => {
    const queryClient = new QueryClient();
    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.typing,
      data: { conversationId: 'conv-a', typing: true, seconds: 5 },
    });
    result.current({
      eventType: RealtimeEventType.typing,
      data: { conversationId: 'conv-a', typing: false, seconds: 0 },
    });

    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(false);

    // The set-to-false spy check: advancing well past the original TTL should not throw or
    // re-trigger anything odd (timer was cleared, nothing scheduled for false events).
    jest.advanceTimersByTime(10_000);
    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(false);
  });

  it('defaults to a 5s TTL when seconds is 0', async () => {
    const queryClient = new QueryClient();
    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.typing,
      data: { conversationId: 'conv-a', typing: true, seconds: 0 },
    });

    jest.advanceTimersByTime(4999);
    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(true);
    jest.advanceTimersByTime(1);
    expect(useChatStore.getState().typingByConversation['conv-a']).toBe(false);
  });

  it('conversationUpdated patches only the matching conversations-list row', async () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.ws.conversations.list(WORKSPACE_ID, {});
    queryClient.setQueryData(
      listKey,
      conversationsCache([
        fakeConversation({ id: 'conv-a', botEnabled: true }),
        fakeConversation({ id: 'conv-b', botEnabled: true }),
      ]),
    );

    const { result } = await renderHook(() => useRealtimeHandlers(queryClient, WORKSPACE_ID));

    result.current({
      eventType: RealtimeEventType.conversationUpdated,
      data: { conversationIds: ['conv-a'], changes: { botEnabled: false } },
    });

    const data = queryClient.getQueryData<ReturnType<typeof conversationsCache>>(listKey);
    const rows = data!.pages[0]!.data;
    expect(rows.find((r) => r.id === 'conv-a')?.botEnabled).toBe(false);
    expect(rows.find((r) => r.id === 'conv-b')?.botEnabled).toBe(true);
  });
});
