import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';

import { useContactNoteMutations } from './use-contact-notes';

jest.mock('@/api/client', () => ({
  apiClient: { POST: jest.fn(), PUT: jest.fn(), DELETE: jest.fn() },
}));

const mocks = apiClient as unknown as Record<'POST' | 'PUT' | 'DELETE', jest.Mock>;

afterEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, invalidate, Wrapper };
}

describe('useContactNoteMutations', () => {
  const detailKey = { queryKey: queryKeys.ws.contacts.detail('ws-1', 'c-1') };

  it('creates a note and refreshes the contact', async () => {
    mocks.POST.mockResolvedValue({ data: {}, error: undefined });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useContactNoteMutations('ws-1', 'c-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.create.mutate('hello'));

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(mocks.POST).toHaveBeenCalledWith('/v1/contacts/{identifier}/notes', {
      params: { path: { identifier: 'id:c-1' } },
      body: { text: 'hello' },
    });
    expect(invalidate).toHaveBeenCalledWith(detailKey);
    queryClient.clear();
  });

  it('updates a note', async () => {
    mocks.PUT.mockResolvedValue({ data: {}, error: undefined });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useContactNoteMutations('ws-1', 'c-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.update.mutate({ noteId: 'n-1', text: 'edited' }));

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(mocks.PUT).toHaveBeenCalledWith('/v1/contacts/{identifier}/notes/{noteId}', {
      params: { path: { identifier: 'id:c-1', noteId: 'n-1' } },
      body: { text: 'edited' },
    });
    expect(invalidate).toHaveBeenCalledWith(detailKey);
    queryClient.clear();
  });

  it('deletes a note and surfaces errors', async () => {
    mocks.DELETE.mockResolvedValue({ data: undefined, error: { status: 500, message: 'x' } });
    const { queryClient, Wrapper } = setup();
    const { result } = await renderHook(() => useContactNoteMutations('ws-1', 'c-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.remove.mutate('n-1'));

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    queryClient.clear();
  });
});
