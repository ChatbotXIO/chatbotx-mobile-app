import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { queryKeys } from '@/api/query-keys';
import type {
  ContactListItem,
  ListContactsResponse,
} from '@/features/contacts/api/use-contacts-infinite';

import { useDeleteContact } from './use-delete-contact';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('@/api/auth-token', () => ({
  getAuthToken: jest.fn().mockResolvedValue('test-token'),
}));

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockFetch.mockReset();
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

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteContact', () => {
  it('throws without calling fetch while FEATURES.deleteContact is false', async () => {
    const queryClient = createTestQueryClient();

    const { result } = await renderHook(() => useDeleteContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic removal from the contacts-list cache on error', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'boom', json: async () => ({}) });
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
});
