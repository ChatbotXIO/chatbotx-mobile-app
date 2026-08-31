import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { ToastProvider } from '@/components/ui/toast';
import { initI18n } from '@/i18n';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

import { ConversationActionsSheet } from './conversation-actions-sheet';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@/api/client', () => ({
  apiClient: {
    GET: jest.fn(),
    POST: jest.fn(),
    DELETE: jest.fn(),
  },
}));

jest.mock('@/api/auth-token', () => ({
  getAuthToken: jest.fn().mockResolvedValue('test-token'),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

// `BottomSheetFlatList` (used by the nested `AssignmentSheet`) wires a reanimated
// `useAnimatedScrollHandler`, which requires the worklets babel plugin to actually compile its
// handlers into worklets — this project has no babel.config.js (relies on the expo preset), and
// under plain Jest that plugin never runs, so the handler throws "not a worklet" at mount. This
// is a pre-existing gap (no test in the app has ever rendered `AssignmentSheet`), not something
// this component introduces — stub the list to a plain RN FlatList, which needs no worklets.
// `BottomSheetModal` (now used by both this sheet and the nested `AssignmentSheet`, since the
// snappy-balloon fix converted them from inline `Sheet` to portal-based `SheetModal`) renders
// through `@gorhom/portal`'s `PortalProvider`, which this RNTL setup can't resolve — stub it to a
// forwardRef pass-through that renders its children directly and exposes no-op present/dismiss,
// so tests can still assert on/interact with the sheet's content.
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet');
  // jest.mock factories cannot reference out-of-scope imports; requiring inline is the standard
  // Jest pattern.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FlatList, View } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef, useImperativeHandle } = require('react');
  // `SheetModal` (sheet.tsx) wraps its children in `BottomSheetView`, which — like
  // `BottomSheetFlatList` above — reads `useBottomSheetInternal()` context that only the real
  // `BottomSheet`/`BottomSheetModal` component tree provides; stub it to a plain View too.
  const BottomSheetModal = forwardRef(function BottomSheetModal(
    { children }: PropsWithChildren,
    ref: import('react').Ref<{ present: () => void; dismiss: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
    return children;
  });
  return {
    __esModule: true,
    ...actual,
    BottomSheetFlatList: FlatList,
    BottomSheetView: View,
    BottomSheetModal,
  };
});

const mockedPost = apiClient.POST as jest.Mock;
const mockedGet = apiClient.GET as jest.Mock;

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  mockedPost.mockResolvedValue({ error: undefined });
  mockedGet.mockResolvedValue({ data: { data: [] }, error: undefined });
});

afterEach(() => {
  mockedPost.mockReset();
  mockedGet.mockReset();
});

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-1',
    contactId: 'contact-1',
    botEnabled: false,
    botResumeAt: null,
    archivedAt: null,
    followed: false,
    assignedUser: null,
    assignedInboxTeam: null,
    contact: { fullName: 'Jane Doe', avatar: null, blockedAt: null },
    ...overrides,
  } as unknown as ConversationListItem;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

describe('ConversationActionsSheet', () => {
  it('calls enable-bot when the bot is off and the toggle is pressed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation({ botEnabled: false })}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.press(screen.getByText('Enable bot'));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/workspaces/{workspaceId}/conversations/enable-bot',
        expect.objectContaining({ body: { ids: ['conv-1'] } }),
      ),
    );
  });

  it('calls disable-bot when the bot is on and the toggle is pressed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation({ botEnabled: true })}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.press(screen.getByText('Disable bot'));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/workspaces/{workspaceId}/conversations/disable-bot',
        expect.objectContaining({ body: { ids: ['conv-1'] } }),
      ),
    );
  });

  it('omits the top-level Unassign row when the conversation has no assignee', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation()}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    // `AssignmentSheet` (nested inside `ConversationActionsSheet`) lazy-mounts only after "Assign"
    // is pressed at least once (it fires its own ungated members-list query on mount) — press it
    // first so its own unconditional "Unassign" row in the member picker list is present, then
    // assert only the top-level sheet's conditional row appears/disappears here.
    fireEvent.press(screen.getByText('Assign'));
    await waitFor(() => expect(screen.getAllByText('Unassign')).toHaveLength(1));
  });

  it('shows the top-level Unassign row when the conversation has an assignee', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation({
          assignedUser: { name: 'Bob' } as ConversationListItem['assignedUser'],
        })}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.press(screen.getByText('Assign'));
    await waitFor(() => expect(screen.getAllByText('Unassign')).toHaveLength(2));
  });

  it('does not fetch the members list until Assign is pressed (lazy-mounted AssignmentSheet)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation()}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    expect(mockedGet).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Assign'));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
  });

  it('disables block/delete and shows Coming soon while their feature flags are off', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation()}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    const comingSoonBadges = screen.getAllByText('Coming soon');
    expect(comingSoonBadges.length).toBe(2);

    fireEvent.press(screen.getByText('Block contact'));
    fireEvent.press(screen.getByText('Delete contact'));
    expect(mockedPost).not.toHaveBeenCalledWith(
      expect.stringContaining('/block'),
      expect.anything(),
    );
  });

  it('omits send flow and saved replies list items when their callbacks are not passed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation()}
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    expect(screen.queryByText('Send flow')).toBeNull();
    expect(screen.queryByText('Saved replies')).toBeNull();
  });

  it('renders send flow and saved replies when their callbacks are passed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ConversationActionsSheet
        workspaceId="ws-1"
        conversationId="conv-1"
        conversation={fakeConversation()}
        onClose={() => {}}
        onSendFlow={() => {}}
        onSavedReplies={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    expect(screen.getByText('Send flow')).toBeTruthy();
    expect(screen.getByText('Saved replies')).toBeTruthy();
  });
});
