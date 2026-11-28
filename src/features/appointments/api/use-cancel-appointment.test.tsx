import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';

import { useBookAppointment } from './use-book-appointment';
import { useCancelAppointment } from './use-cancel-appointment';

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

describe('useCancelAppointment', () => {
  it('cancels and invalidates the appointment lists', async () => {
    mockPost.mockResolvedValue({ data: { id: 'a1' }, error: undefined });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useCancelAppointment('ws-1'), { wrapper: Wrapper });

    act(() => result.current.mutate('a1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/v1/appointments/{id}/cancel', {
      params: { path: { id: 'a1' } },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ws.appointments.all('ws-1') });
    queryClient.clear();
  });
});

describe('useBookAppointment', () => {
  const input = {
    calendarId: 'cal-1',
    contactId: 'c-1',
    conversationId: 'conv-1',
    startAt: '2026-12-01T03:00:00.000Z',
    inviteeTimezone: 'Asia/Ho_Chi_Minh',
  };

  it('books and invalidates the appointment lists', async () => {
    mockPost.mockResolvedValue({ data: { id: 'a2' }, error: undefined });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useBookAppointment('ws-1'), { wrapper: Wrapper });

    act(() => result.current.mutate(input));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/v1/appointments', { body: input });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ws.appointments.all('ws-1') });
    queryClient.clear();
  });

  it('refetches availability when booking fails (stale slot / 409)', async () => {
    mockPost.mockResolvedValue({
      data: undefined,
      error: { code: 'businessError', status: 409, message: 'Slot taken' },
    });
    const { queryClient, invalidate, Wrapper } = setup();
    const { result } = await renderHook(() => useBookAppointment('ws-1'), { wrapper: Wrapper });

    act(() => result.current.mutate(input));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.ws.appointmentCalendars.availability('ws-1', 'cal-1', {
        contactId: 'c-1',
      }),
    });
    queryClient.clear();
  });
});
