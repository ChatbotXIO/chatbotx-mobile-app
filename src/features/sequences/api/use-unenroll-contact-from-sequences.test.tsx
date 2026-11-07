import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';

import { useUnenrollContactFromSequences } from './use-unenroll-contact-from-sequences';

jest.mock('@/api/client', () => ({
  apiClient: { DELETE: jest.fn() },
}));

const mockDelete = apiClient.DELETE as jest.Mock;

afterEach(() => {
  mockDelete.mockReset();
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUnenrollContactFromSequences', () => {
  it('unsubscribes through the public API using the prefixed contact identifier', async () => {
    mockDelete.mockResolvedValue({ data: undefined, error: undefined });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });

    const { result } = await renderHook(
      () => useUnenrollContactFromSequences('ws-1', 'contact-1'),
      {
        wrapper: wrapper(queryClient),
      },
    );

    act(() => {
      result.current.mutate('seq-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('/v1/contacts/{identifier}/sequences', {
      params: { path: { identifier: 'id:contact-1' } },
      body: { sequenceIds: ['seq-1'] },
    });

    queryClient.clear();
    queryClient.unmount();
  });

  it('surfaces API errors', async () => {
    mockDelete.mockResolvedValue({
      data: undefined,
      error: { defined: true, code: 'businessError', status: 400, message: 'nope' },
    });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });

    const { result } = await renderHook(
      () => useUnenrollContactFromSequences('ws-1', 'contact-1'),
      {
        wrapper: wrapper(queryClient),
      },
    );

    act(() => {
      result.current.mutate('seq-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    queryClient.clear();
    queryClient.unmount();
  });
});
