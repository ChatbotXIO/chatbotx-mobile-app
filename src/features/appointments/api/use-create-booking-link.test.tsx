import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';

import { useCreateBookingLink } from './use-create-booking-link';

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

describe('useCreateBookingLink', () => {
  it('posts the link and refreshes conversation state when sending', async () => {
    mockPost.mockResolvedValue({
      data: { url: 'https://book.test/x', expiresAt: '2026-12-01T00:00:00Z', calendar: {} },
      error: undefined,
    });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useCreateBookingLink('ws-1', 'conv-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.mutate({ calendarId: 'cal-1', send: true }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/v1/conversations/{id}/appointment-booking-link', {
      params: { path: { id: 'conv-1' } },
      body: { calendarId: 'cal-1', send: true },
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.ws.conversations.detail('ws-1', 'conv-1'),
    });
    queryClient.clear();
  });

  it('does not touch caches when only fetching the link', async () => {
    mockPost.mockResolvedValue({
      data: { url: 'https://book.test/x', expiresAt: '2026-12-01T00:00:00Z', calendar: {} },
      error: undefined,
    });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useCreateBookingLink('ws-1', 'conv-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.mutate({ calendarId: 'cal-1', send: false }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('surfaces API errors', async () => {
    mockPost.mockResolvedValue({ data: undefined, error: { code: 'businessError', status: 400 } });
    const { queryClient, Wrapper } = setup();
    const { result } = await renderHook(() => useCreateBookingLink('ws-1', 'conv-1'), {
      wrapper: Wrapper,
    });

    act(() => result.current.mutate({ calendarId: 'cal-1', send: true }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    queryClient.clear();
  });
});
