import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useDeleteAccount } from './use-delete-account';

const mockSignOutLocally = jest.fn();

jest.mock('@/api/client', () => ({
  apiClient: { DELETE: jest.fn() },
}));
jest.mock('@/features/auth/use-sign-out', () => ({
  useSignOutLocally: () => mockSignOutLocally,
}));

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDeleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends DELETE /v1/me with the DELETE confirmation, then signs out locally without revoking', async () => {
    (apiClient.DELETE as jest.Mock).mockResolvedValue({
      data: { scheduledDeletionAt: '2026-11-20T00:00:00.000Z' },
    });
    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiClient.DELETE).toHaveBeenCalledWith('/v1/me', { body: { confirmation: 'DELETE' } });
    expect(mockSignOutLocally).toHaveBeenCalledWith({ revokeToken: false });
  });

  it('throws ApiError and keeps the session when the server rejects', async () => {
    (apiClient.DELETE as jest.Mock).mockResolvedValue({
      error: { code: 'accountDeletionSupportRequired', status: 403, message: 'Contact support' },
    });
    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBeInstanceOf(ApiError);
    });

    expect(mockSignOutLocally).not.toHaveBeenCalled();
  });
});
