import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';

import { useResendMessage } from './use-resend-message';

jest.mock('@/api/client', () => ({
  apiClient: { POST: jest.fn() },
}));

const mockPost = apiClient.POST as jest.Mock;
afterEach(() => mockPost.mockReset());

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, invalidate, Wrapper };
}

describe('useResendMessage', () => {
  it('posts the resend and refetches the messages', async () => {
    mockPost.mockResolvedValue({ data: {}, error: undefined });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useResendMessage('ws-1', 'conv-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.mutate({ messageId: 'm-1', createdAt: '2026-01-01T00:00:00Z' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith(
      '/v1/conversations/{conversationId}/messages/{messageId}/resend',
      {
        params: { path: { conversationId: 'conv-1', messageId: 'm-1' } },
        body: { createdAt: '2026-01-01T00:00:00Z' },
      },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.ws.messages.list('ws-1', 'conv-1'),
    });
    queryClient.clear();
  });
});
