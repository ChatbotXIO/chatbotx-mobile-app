import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { queryKeys } from '@/api/query-keys';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';

import { useBlockContact, useUnblockContact } from './use-contact-block';

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

function fakeContact(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: 'contact-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    avatar: null,
    phoneNumber: null,
    email: null,
    fullName: 'Jane Doe',
    workspaceId: 'ws-1',
    blockedAt: null,
    tags: [],
    customFields: [],
    contactNotes: [],
    contactsOnSequences: [],
    ...overrides,
  } as unknown as ContactDetail;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBlockContact', () => {
  it('throws without calling fetch while FEATURES.blockContact is false', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.ws.contacts.detail('ws-1', 'contact-1'), fakeContact());

    const { result } = await renderHook(() => useBlockContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic blockedAt patch on error', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'boom', json: async () => ({}) });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    queryClient.setQueryData(detailKey, fakeContact());

    const { result } = await renderHook(() => useBlockContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<ContactDetail>(detailKey)?.blockedAt).toBeNull();
  });
});

describe('useUnblockContact', () => {
  it('throws without calling fetch while FEATURES.blockContact is false', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.ws.contacts.detail('ws-1', 'contact-1'),
      fakeContact({ blockedAt: '2026-01-01T00:00:00.000Z' }),
    );

    const { result } = await renderHook(() => useUnblockContact('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('contact-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
