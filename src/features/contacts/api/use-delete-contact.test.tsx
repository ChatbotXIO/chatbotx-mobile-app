import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import type {
  ContactListItem,
  ListContactsResponse,
} from '@/features/contacts/api/use-contacts-infinite';
import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

import { useDeleteContact } from './use-delete-contact';

jest.mock('@/api/client', () => ({
  apiClient: { DELETE: jest.fn() },
}));

const mockDelete = apiClient.DELETE as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockDelete.mockReset();
  while (activeQueryClients.length > 0) {
    const queryClient = activeQueryClients.pop()!;
    queryClient.clear();
    queryClient.unmount();
  }
});

function fakeContactListItem(id: string): ContactListItem {
  return {
    id,
    fullName: `Contact ${id}`,
    email: null,
    phoneNumber: null,
    avatar: null,
  } as unknown as ContactListItem;
}

function fakeConversationListItem(id: string, contactId: string): ConversationListItem {
  return {
    id,
    contactId,
    contact: { id: contactId, blockedAt: null },
  } as unknown as ConversationListItem;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteContact', () => {
  it('deletes through the public API using the prefixed contact identifier', async () => {
    mockDelete.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = createTestQueryClient();

    const { result } = await renderHook(() => useDeleteContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('/v1/contacts/{identifier}', {
      params: { path: { identifier: 'id:contact-1' } },
    });
  });

  it('rolls back the optimistic removal from the contacts-list cache on error', async () => {
    mockDelete.mockResolvedValue({ data: undefined, error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const listKey = queryKeys.ws.contacts.list('ws-1', { keyword: '' });
    const page: ListContactsResponse = {
      data: [fakeContactListItem('contact-1'), fakeContactListItem('contact-2')],
      page: 1,
      perPage: 30,
      pageCount: 1,
      totalCount: 2,
    } as unknown as ListContactsResponse;
    queryClient.setQueryData(listKey, { pages: [page], pageParams: [1] });

    const { result } = await renderHook(() => useDeleteContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = queryClient.getQueryData<{ pages: ListContactsResponse[] }>(listKey);
    expect(cached?.pages[0]?.data.map((item) => item.id)).toEqual(['contact-1', 'contact-2']);
  });

  it('removes only the deleted contact rows from the conversations-list cache on success', async () => {
    mockDelete.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = createTestQueryClient();
    const conversationsListKey = queryKeys.ws.conversations.list('ws-1', {});
    const conversationsPage: ListConversationsResponse = {
      data: [
        fakeConversationListItem('conv-1', 'contact-1'),
        fakeConversationListItem('conv-2', 'contact-2'),
      ],
    } as unknown as ListConversationsResponse;
    queryClient.setQueryData(conversationsListKey, {
      pages: [conversationsPage],
      pageParams: [undefined],
    });

    const { result } = await renderHook(() => useDeleteContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: ListConversationsResponse[] }>(
      conversationsListKey,
    );
    expect(cached?.pages[0]?.data.map((item) => item.id)).toEqual(['conv-2']);
  });
});
