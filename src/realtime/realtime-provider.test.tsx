import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import { apiClient } from '@/api/client';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { RealtimeProvider } from './realtime-provider';
import { RealtimeFatalError } from './protocol/realtime-socket';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockResume = jest.fn();
const mockCreateRealtimeConnection = jest.fn();

jest.mock('@/api/client', () => ({
  apiClient: { GET: jest.fn() },
}));
jest.mock('./realtime-connection', () => ({
  createRealtimeConnection: (...args: unknown[]) => mockCreateRealtimeConnection(...args),
}));
jest.mock('./use-realtime-handlers', () => ({
  clearPendingConversationInvalidates: jest.fn(),
  useRealtimeHandlers: () => jest.fn(),
}));
jest.mock('./app-state', () => ({
  invalidateWorkspaceQueries: jest.fn(),
  useRealtimeAppState: jest.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('RealtimeProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      useWorkspaceStore.setState({ currentWorkspaceId: 'workspace-1' });
    });
    mockCreateRealtimeConnection.mockImplementation(() => ({
      start: mockStart,
      stop: mockStop,
      resume: mockResume,
    }));
  });

  afterEach(async () => {
    await act(async () => {
      useWorkspaceStore.setState({ currentWorkspaceId: null });
    });
  });

  it('mints a gateway URL with its replay cursor through the member-scoped connect-token endpoint', async () => {
    jest.mocked(apiClient.GET).mockResolvedValue({
      data: { socketUrl: 'wss://realtime.example.test/connect', token: 'connect-token' },
      error: undefined,
    } as never);
    const queryClient = new QueryClient();
    let getUrl: ((lastSeq: string | null) => Promise<string>) | undefined;
    mockCreateRealtimeConnection.mockImplementation((options: { getUrl: typeof getUrl }) => {
      getUrl = options.getUrl;
      return { start: mockStart, stop: mockStop, resume: mockResume };
    });

    const { unmount } = await render(
      <RealtimeProvider>
        <Text>Inbox</Text>
      </RealtimeProvider>,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(getUrl).toBeDefined());

    await expect(getUrl!('42')).resolves.toBe(
      'wss://realtime.example.test/connect?token=connect-token&lastSeq=42',
    );
    expect(apiClient.GET).toHaveBeenCalledWith('/v1/realtime/connect-token');
    expect(mockStart).toHaveBeenCalledTimes(1);
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });

  it('stops reconnecting when connect-token minting fails permanently', async () => {
    jest.mocked(apiClient.GET).mockResolvedValue({
      data: undefined,
      error: { message: 'Membership revoked', status: 403 },
    } as never);
    const queryClient = new QueryClient();
    let getUrl: ((lastSeq: string | null) => Promise<string>) | undefined;
    mockCreateRealtimeConnection.mockImplementation((options: { getUrl: typeof getUrl }) => {
      getUrl = options.getUrl;
      return { start: mockStart, stop: mockStop, resume: mockResume };
    });

    const { unmount } = await render(
      <RealtimeProvider>
        <Text>Inbox</Text>
      </RealtimeProvider>,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(getUrl).toBeDefined());

    await expect(getUrl!(null)).rejects.toBeInstanceOf(RealtimeFatalError);
    await unmount();
    queryClient.clear();
    queryClient.unmount();
  });
});
