import { fireEvent, render, screen } from '@testing-library/react-native';

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

// `BottomSheetModal` renders through `@gorhom/portal`, which this RNTL setup can't resolve —
// stub it to a plain View so the sheet's children render inline.
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    BottomSheetBackdrop: View,
    BottomSheetModal: View,
    BottomSheetView: View,
  };
});

beforeAll(() => {
  initI18n();
});

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-1',
    botEnabled: false,
    botResumeAt: null,
    archivedAt: null,
    agentLastReadAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as ConversationListItem;
}

async function renderSheet(conversation: ConversationListItem | null) {
  const handlers = {
    onToggleRead: jest.fn(),
    onToggleBot: jest.fn(),
    onArchive: jest.fn(),
    onAssign: jest.fn(),
    onClose: jest.fn(),
  };
  await render(<ConversationActionsSheet conversation={conversation} {...handlers} />);
  return handlers;
}

describe('ConversationActionsSheet', () => {
  it('offers "Mark as unread", "Enable bot" and "Archive" for a read, bot-off, active conversation', async () => {
    await renderSheet(fakeConversation());

    expect(screen.getByText('Mark as unread')).toBeTruthy();
    expect(screen.getByText('Enable bot')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Assign')).toBeTruthy();
  });

  it('flips labels for an unread, bot-on, archived conversation', async () => {
    await renderSheet(
      fakeConversation({
        agentLastReadAt: '2025-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
        botEnabled: true,
        archivedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    expect(screen.getByText('Mark as read')).toBeTruthy();
    expect(screen.getByText('Disable bot')).toBeTruthy();
    expect(screen.getByText('Unarchive')).toBeTruthy();
  });

  it.each([
    ['Mark as unread', 'onToggleRead'],
    ['Enable bot', 'onToggleBot'],
    ['Archive', 'onArchive'],
    ['Assign', 'onAssign'],
  ] as const)(
    'pressing "%s" closes the sheet and calls %s with the conversation',
    async (label, key) => {
      const conversation = fakeConversation();
      const handlers = await renderSheet(conversation);

      fireEvent.press(screen.getByText(label));

      expect(handlers.onClose).toHaveBeenCalledTimes(1);
      expect(handlers[key]).toHaveBeenCalledWith(conversation);
    },
  );

  it('renders no action items before a conversation is selected', async () => {
    await renderSheet(null);

    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByText('Assign')).toBeNull();
  });
});
