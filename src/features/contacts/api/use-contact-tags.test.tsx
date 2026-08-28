import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { useAddContactTag, useRemoveContactTag } from '@/features/contacts/api/use-contact-tags';

jest.mock('@/api/client', () => ({
  apiClient: {
    POST: jest.fn(),
    DELETE: jest.fn(),
  },
}));

const mockedPost = apiClient.POST as jest.Mock;
const mockedDelete = apiClient.DELETE as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  mockedPost.mockReset();
  mockedDelete.mockReset();
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
    tags: [],
    customFields: [],
    contactNotes: [],
    contactsOnSequences: [],
    ...overrides,
  } as unknown as ContactDetail;
}

function fakeTag(id: string, name: string) {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    folderId: null,
    workspaceId: 'ws-1',
  } as unknown as ContactDetail['tags'][number];
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAddContactTag', () => {
  it('optimistically pushes the full tag object into the cached contact-detail tags array', async () => {
    mockedPost.mockResolvedValue({ error: undefined });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    queryClient.setQueryData(detailKey, fakeContact());

    const { result } = await renderHook(() => useAddContactTag('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    const tag = fakeTag('tag-1', 'VIP');
    act(() => {
      result.current.mutate(tag);
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ContactDetail>(detailKey);
      expect(detail?.tags).toEqual([tag]);
    });
  });

  it('rolls back the optimistic tag on error', async () => {
    mockedPost.mockResolvedValue({ error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    queryClient.setQueryData(detailKey, fakeContact());

    const { result } = await renderHook(() => useAddContactTag('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(fakeTag('tag-1', 'VIP'));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<ContactDetail>(detailKey)?.tags).toEqual([]);
  });

  it('invalidates the detail query on settle to reconcile with server truth', async () => {
    mockedPost.mockResolvedValue({ error: undefined });
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    queryClient.setQueryData(detailKey, fakeContact());

    const { result } = await renderHook(() => useAddContactTag('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(fakeTag('tag-1', 'VIP'));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: detailKey });
  });
});

describe('useRemoveContactTag', () => {
  it('optimistically removes the tag from the cached contact-detail tags array', async () => {
    mockedDelete.mockResolvedValue({ error: undefined });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    const tag = fakeTag('tag-1', 'VIP');
    queryClient.setQueryData(detailKey, fakeContact({ tags: [tag] }));

    const { result } = await renderHook(() => useRemoveContactTag('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('tag-1');
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ContactDetail>(detailKey);
      expect(detail?.tags).toEqual([]);
    });
  });

  it('rolls back the optimistic removal on error', async () => {
    mockedDelete.mockResolvedValue({ error: { message: 'boom' } });
    const queryClient = createTestQueryClient();
    const detailKey = queryKeys.ws.contacts.detail('ws-1', 'contact-1');
    const tag = fakeTag('tag-1', 'VIP');
    queryClient.setQueryData(detailKey, fakeContact({ tags: [tag] }));

    const { result } = await renderHook(() => useRemoveContactTag('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate('tag-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<ContactDetail>(detailKey)?.tags).toEqual([tag]);
  });
});
