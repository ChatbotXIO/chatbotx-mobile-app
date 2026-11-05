import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';

import { useEnrollContactInSequences } from './use-enroll-contact-in-sequences';

jest.mock('@/api/client', () => ({
  apiClient: { POST: jest.fn() },
}));

const mockPost = apiClient.POST as jest.Mock;

afterEach(() => {
  mockPost.mockReset();
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEnrollContactInSequences', () => {
  it('enrolls through the public API using the prefixed contact identifier', async () => {
    mockPost.mockResolvedValue({ data: {}, error: undefined });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });

    const { result } = await renderHook(() => useEnrollContactInSequences('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(['seq-1']);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/v1/contacts/{identifier}/sequences', {
      params: { path: { identifier: 'id:contact-1' } },
      body: { sequenceIds: ['seq-1'] },
    });

    queryClient.clear();
    queryClient.unmount();
  });
});
