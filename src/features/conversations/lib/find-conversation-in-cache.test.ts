import { QueryClient } from '@tanstack/react-query';

import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

import { findConversationInListCache } from './find-conversation-in-cache';

function fakeConversation(id: string): ConversationListItem {
  return {
    id,
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
  } as unknown as ConversationListItem;
}

function fakePage(items: ConversationListItem[]): ListConversationsResponse {
  return { data: items, nextCursor: null, prevCursor: null };
}

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

describe('findConversationInListCache', () => {
  it('finds a conversation cached in a list query page for the given workspace', () => {
    const queryClient = createTestQueryClient();
    const target = fakeConversation('conv-1');
    queryClient.setQueryData(['ws', 'ws-1', 'conversations', 'list', { keyword: '' }], {
      pages: [fakePage([fakeConversation('conv-0'), target])],
      pageParams: [undefined],
    });

    const found = findConversationInListCache(queryClient, 'ws-1', 'conv-1');

    expect(found?.id).toBe('conv-1');
  });

  it('searches across every cached list query (different filter combinations)', () => {
    const queryClient = createTestQueryClient();
    const target = fakeConversation('conv-2');
    queryClient.setQueryData(['ws', 'ws-1', 'conversations', 'list', { keyword: '' }], {
      pages: [fakePage([fakeConversation('conv-0')])],
      pageParams: [undefined],
    });
    queryClient.setQueryData(['ws', 'ws-1', 'conversations', 'list', { status: ['unread'] }], {
      pages: [fakePage([target])],
      pageParams: [undefined],
    });

    const found = findConversationInListCache(queryClient, 'ws-1', 'conv-2');

    expect(found?.id).toBe('conv-2');
  });

  it('returns undefined when the conversation is not cached', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', 'ws-1', 'conversations', 'list', {}], {
      pages: [fakePage([fakeConversation('conv-0')])],
      pageParams: [undefined],
    });

    expect(findConversationInListCache(queryClient, 'ws-1', 'missing')).toBeUndefined();
  });

  it('does not match conversations cached under a different workspace', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', 'ws-other', 'conversations', 'list', {}], {
      pages: [fakePage([fakeConversation('conv-1')])],
      pageParams: [undefined],
    });

    expect(findConversationInListCache(queryClient, 'ws-1', 'conv-1')).toBeUndefined();
  });

  it('returns undefined when no list queries are cached at all', () => {
    const queryClient = createTestQueryClient();
    expect(findConversationInListCache(queryClient, 'ws-1', 'conv-1')).toBeUndefined();
  });
});
