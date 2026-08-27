import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useAuthStore } from '@/stores/use-auth-store';

jest.mock('@/api/client', () => ({
  apiClient: {
    GET: jest.fn(),
  },
}));

const mockedGet = apiClient.GET as jest.Mock;

const activeQueryClients: QueryClient[] = [];

function createTestQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  activeQueryClients.push(queryClient);
  return queryClient;
}

function renderPermissions(queryClient: QueryClient, workspaceId: string | null) {
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => usePermissions(workspaceId), { wrapper });
}

function member(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    permissions: {
      superAdmin: false,
      analytics: true,
      flows: true,
      contacts: true,
      onlyAssignedContacts: false,
      emailAndPhone: true,
      broadcast: true,
      ecommerce: true,
    },
    ...overrides,
  };
}

describe('usePermissions', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'user-1', email: 'a@b.com', name: 'A', mustChangePassword: false },
    });
  });

  afterEach(() => {
    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop()!;
      queryClient.clear();
      queryClient.unmount();
    }
  });

  it('fails closed on PII-masking bits while the members query is loading', async () => {
    // Never resolves during this assertion window — simulates the loading state.
    mockedGet.mockReturnValue(new Promise(() => {}));
    const queryClient = createTestQueryClient();

    const { result } = await renderPermissions(queryClient, 'ws-1');

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canSeeEmailAndPhone).toBe(false);
    expect(result.current.onlyAssignedContacts).toBe(true);
  });

  it('fails closed on PII-masking bits when the member row is not found', async () => {
    mockedGet.mockResolvedValue({ data: { data: [member({ userId: 'someone-else' })] } });
    const queryClient = createTestQueryClient();

    const { result } = await renderPermissions(queryClient, 'ws-1');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSeeEmailAndPhone).toBe(false);
    expect(result.current.onlyAssignedContacts).toBe(true);
  });

  it('resolves the real permission bits once the member row loads', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [member({ permissions: { ...member().permissions, emailAndPhone: false } })] },
    });
    const queryClient = createTestQueryClient();

    const { result } = await renderPermissions(queryClient, 'ws-1');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSeeEmailAndPhone).toBe(false);
    expect(result.current.onlyAssignedContacts).toBe(false);
  });

  it('super admins bypass every restriction once loaded', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [member({ permissions: { ...member().permissions, superAdmin: true } })] },
    });
    const queryClient = createTestQueryClient();

    const { result } = await renderPermissions(queryClient, 'ws-1');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.canSeeEmailAndPhone).toBe(true);
  });

  it('fails closed while workspaceId is null', async () => {
    const queryClient = createTestQueryClient();
    const { result } = await renderPermissions(queryClient, null);

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canSeeEmailAndPhone).toBe(false);
  });
});
