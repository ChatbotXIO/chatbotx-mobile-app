import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { apiClient } from '@/api/client';
import { ToastProvider } from '@/components/ui/toast';
import { initI18n } from '@/i18n';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';

import { ContactActionsSheet } from './contact-actions-sheet';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@/features/contacts/components/custom-field-editor-sheet', () => ({
  CustomFieldEditorSheet: () => null,
}));
jest.mock('@/features/contacts/components/tag-picker-sheet', () => ({
  TagPickerSheet: () => null,
}));
jest.mock('@/features/sequences/components/sequence-picker-sheet', () => ({
  SequencePickerSheet: () => null,
}));
jest.mock('@/features/conversations/components/assignment-sheet', () => ({
  AssignmentSheet: () => null,
}));

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

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// `BottomSheetFlatList` needs the reanimated worklets babel plugin (see the matching comment in
// conversation-actions-sheet.test.tsx) — stub to a plain FlatList. `BottomSheetModal` (used by
// the nested `CustomFieldEditorSheet`'s editor sheet, via our own `SheetModal` wrapper) renders
// through `@gorhom/portal`'s `PortalProvider`, which this RNTL setup can't resolve — nothing in
// this file exercises that editor modal, so stub it to a no-op that renders nothing.
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet');
  // jest.mock factories cannot reference out-of-scope imports; requiring inline is the standard
  // Jest pattern.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FlatList } = require('react-native');
  return {
    __esModule: true,
    ...actual,
    BottomSheetFlatList: FlatList,
    BottomSheetModal: () => null,
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
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

afterEach(() => {
  mockedPost.mockReset();
  mockedGet.mockReset();
  mockFetch.mockReset();
});

function fakeContact(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: 'contact-1',
    fullName: 'Jane Doe',
    email: null,
    phoneNumber: null,
    avatar: null,
    blockedAt: null,
    tags: [],
    customFields: [],
    contactNotes: [],
    contactsOnSequences: [],
    ...overrides,
  } as unknown as ContactDetail;
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

describe('ContactActionsSheet', () => {
  it('omits the Message row when no conversationId is passed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ContactActionsSheet workspaceId="ws-1" contact={fakeContact()} onClose={() => {}} />,
      { wrapper: wrapper(queryClient) },
    );

    expect(screen.queryByText('Message')).toBeNull();
  });

  it('renders the Message row when a conversationId is passed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ContactActionsSheet
        workspaceId="ws-1"
        contact={fakeContact()}
        conversationId="conv-1"
        onClose={() => {}}
      />,
      { wrapper: wrapper(queryClient) },
    );

    expect(screen.getByText('Message')).toBeTruthy();
  });

  it('disables block/delete and shows Coming soon while their feature flags are off', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ContactActionsSheet workspaceId="ws-1" contact={fakeContact()} onClose={() => {}} />,
      { wrapper: wrapper(queryClient) },
    );

    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('does not call the block endpoint while FEATURES.blockContact is off', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <ContactActionsSheet workspaceId="ws-1" contact={fakeContact()} onClose={() => {}} />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.press(screen.getByText('Block contact'));
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });
});
