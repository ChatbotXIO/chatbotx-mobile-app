import { QueryClient } from '@tanstack/react-query';

import type {
  ContactListItem,
  ListContactsResponse,
} from '@/features/contacts/api/use-contacts-infinite';

import { findContactInListCache } from './find-contact-in-cache';

function fakeContact(id: string, overrides: Partial<ContactListItem> = {}): ContactListItem {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    avatar: null,
    phoneNumber: null,
    email: null,
    fullName: `Contact ${id}`,
    blockedAt: null,
    workspaceId: 'ws-1',
    contactInboxes: [],
    conversation: null,
    ...overrides,
  } as unknown as ContactListItem;
}

function fakePage(items: ContactListItem[]): ListContactsResponse {
  return { data: items, pageCount: 1, totalCount: items.length, totalCountCapped: false };
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

describe('findContactInListCache', () => {
  it('finds a contact cached in a list query page for the given workspace', () => {
    const queryClient = createTestQueryClient();
    const target = fakeContact('contact-1', {
      contactInboxes: [{ channel: 'whatsapp' }] as unknown as ContactListItem['contactInboxes'],
      conversation: { id: 'conv-1' } as unknown as ContactListItem['conversation'],
    });
    queryClient.setQueryData(['ws', 'ws-1', 'contacts', 'list', { keyword: '' }], {
      pages: [fakePage([fakeContact('contact-0'), target])],
      pageParams: [1],
    });

    const found = findContactInListCache(queryClient, 'ws-1', 'contact-1');

    expect(found?.id).toBe('contact-1');
    expect(found?.conversation?.id).toBe('conv-1');
  });

  it('searches across every cached list query (different keyword filters)', () => {
    const queryClient = createTestQueryClient();
    const target = fakeContact('contact-2');
    queryClient.setQueryData(['ws', 'ws-1', 'contacts', 'list', { keyword: '' }], {
      pages: [fakePage([fakeContact('contact-0')])],
      pageParams: [1],
    });
    queryClient.setQueryData(['ws', 'ws-1', 'contacts', 'list', { keyword: 'jane' }], {
      pages: [fakePage([target])],
      pageParams: [1],
    });

    expect(findContactInListCache(queryClient, 'ws-1', 'contact-2')?.id).toBe('contact-2');
  });

  it('returns undefined when the contact is not cached', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', 'ws-1', 'contacts', 'list', {}], {
      pages: [fakePage([fakeContact('contact-0')])],
      pageParams: [1],
    });

    expect(findContactInListCache(queryClient, 'ws-1', 'missing')).toBeUndefined();
  });

  it('does not match contacts cached under a different workspace', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['ws', 'ws-other', 'contacts', 'list', {}], {
      pages: [fakePage([fakeContact('contact-1')])],
      pageParams: [1],
    });

    expect(findContactInListCache(queryClient, 'ws-1', 'contact-1')).toBeUndefined();
  });

  it('returns undefined when no list queries are cached at all', () => {
    const queryClient = createTestQueryClient();
    expect(findContactInListCache(queryClient, 'ws-1', 'contact-1')).toBeUndefined();
  });
});
