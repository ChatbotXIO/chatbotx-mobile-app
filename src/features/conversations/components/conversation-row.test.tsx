import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

import { ConversationRow } from './conversation-row';

beforeAll(() => {
  initI18n();
});

function fakeConversation(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'conv-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    botEnabled: false,
    botResumeAt: null,
    archivedAt: null,
    additionalAttributes: null,
    contactLastReadAt: null,
    agentLastReadAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    followed: false,
    workspaceId: 'ws-1',
    contactId: 'contact-1',
    sourceId: null,
    lastStep: null,
    currentStep: null,
    adminRepliedAt: null,
    contactRepliedAt: null,
    contactInboxes: [{ channel: 'whatsapp' }],
    messages: [{ text: 'Hello there', attachmentCount: 0 }],
    contact: { fullName: 'Jane Doe', avatar: null, blockedAt: null },
    assignedUser: null,
    assignedInboxTeam: null,
    ...overrides,
  } as unknown as ConversationListItem;
}

describe('ConversationRow', () => {
  it('renders the contact name and message preview', async () => {
    await render(<ConversationRow conversation={fakeConversation()} onPress={() => {}} />);

    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  it('falls back to a translated "Unknown contact" label when the contact has no name', async () => {
    await render(
      <ConversationRow conversation={fakeConversation({ contact: null })} onPress={() => {}} />,
    );

    expect(screen.getByText('Unknown contact')).toBeTruthy();
  });

  it('renders a translated attachment preview when the last message has no text', async () => {
    await render(
      <ConversationRow
        conversation={fakeConversation({
          messages: [
            { text: null, attachmentCount: 3 },
          ] as unknown as ConversationListItem['messages'],
        })}
        onPress={() => {}}
      />,
    );

    expect(screen.getByText('📎 3 attachment(s)')).toBeTruthy();
  });

  it('calls onPress when the row is tapped', async () => {
    const onPress = jest.fn();
    await render(<ConversationRow conversation={fakeConversation()} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityActions mirroring the wired swipe callbacks', async () => {
    const onToggleRead = jest.fn();
    const onToggleBot = jest.fn();
    const onArchive = jest.fn();
    await render(
      <ConversationRow
        conversation={fakeConversation()}
        onPress={() => {}}
        onToggleRead={onToggleRead}
        onToggleBot={onToggleBot}
        onArchive={onArchive}
      />,
    );

    const button = screen.getByLabelText(/Jane Doe/);
    const actionNames = (button.props.accessibilityActions as { name: string }[]).map(
      (action) => action.name,
    );
    expect(actionNames).toEqual(['toggleRead', 'toggleBot', 'archive']);

    fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'archive' } });
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('omits accessibilityActions that have no wired callback', async () => {
    await render(<ConversationRow conversation={fakeConversation()} onPress={() => {}} />);

    const button = screen.getByLabelText(/Jane Doe/);
    expect(button.props.accessibilityActions).toEqual([]);
  });

  it('renders an ellipsis button that calls onOpenActions when provided', async () => {
    const onOpenActions = jest.fn();
    await render(
      <ConversationRow
        conversation={fakeConversation()}
        onPress={() => {}}
        onOpenActions={onOpenActions}
      />,
    );

    fireEvent.press(screen.getByLabelText('Open conversation actions'));
    expect(onOpenActions).toHaveBeenCalledTimes(1);
  });

  it('does not render an ellipsis button when onOpenActions is not provided', async () => {
    await render(<ConversationRow conversation={fakeConversation()} onPress={() => {}} />);

    expect(screen.queryByLabelText('Open conversation actions')).toBeNull();
  });

  it('includes unarchive in the swipe/accessibility actions when the conversation is archived', async () => {
    const onArchive = jest.fn();
    await render(
      <ConversationRow
        conversation={fakeConversation({ archivedAt: '2026-01-01T00:00:00.000Z' })}
        onPress={() => {}}
        onArchive={onArchive}
      />,
    );

    const button = screen.getByLabelText(/Jane Doe/);
    const archiveAction = (
      button.props.accessibilityActions as { name: string; label: string }[]
    ).find((action) => action.name === 'archive');
    expect(archiveAction?.label).toBe('Unarchive');
  });
});
