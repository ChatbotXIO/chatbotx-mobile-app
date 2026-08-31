import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { useConversationsInfinite } from '@/features/conversations/api/use-conversations-infinite';
import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { usePermissions } from '@/features/permissions/use-permissions';

jest.mock('@/api/client', () => ({
  apiClient: {
    POST: jest.fn(),
  },
}));

jest.mock('@/features/permissions/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

const mockedPost = apiClient.POST as jest.Mock;
const mockedUsePermissions = usePermissions as jest.Mock;

afterEach(() => {
  mockedPost.mockReset();
  mockedUsePermissions.mockReset();
  useConversationFilters.getState().reset();
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useConversationsInfinite', () => {
  it('sends the active status filter under `tags`, not `status`, in the list request body', async () => {
    mockedUsePermissions.mockReturnValue({ onlyAssignedContacts: false, isLoading: false });
    mockedPost.mockResolvedValue({ data: { data: [], nextCursor: null }, error: undefined });
    useConversationFilters.getState().setStatus(['archived']);

    const queryClient = new QueryClient();
    const { result } = await renderHook(() => useConversationsInfinite('ws-1'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedPost).toHaveBeenCalledWith(
      '/workspaces/{workspaceId}/conversations/list',
      expect.objectContaining({
        body: expect.objectContaining({ tags: ['archived'] }),
      }),
    );
    const [, options] = mockedPost.mock.calls[0];
    expect(options.body).not.toHaveProperty('status');

    queryClient.clear();
    queryClient.unmount();
  });
});
