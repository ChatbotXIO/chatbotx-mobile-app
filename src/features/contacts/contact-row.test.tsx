import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';

import { ContactRow } from './contact-row';

jest.mock('@/features/permissions/use-permissions', () => ({
  usePermissions: () => ({ canSeeEmailAndPhone: true, isLoading: false }),
}));

beforeAll(() => {
  initI18n();
});

function fakeContact(overrides: Partial<ContactListItem> = {}): ContactListItem {
  return {
    id: 'contact-1',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phoneNumber: null,
    avatar: null,
    blockedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    contactInboxes: [{ channel: 'whatsapp' }],
    tags: [],
    conversation: { id: 'conv-1' },
    ...overrides,
  } as unknown as ContactListItem;
}

describe('ContactRow', () => {
  it('renders the contact name and subtitle', async () => {
    await render(<ContactRow contact={fakeContact()} workspaceId="ws-1" onPress={() => {}} />);

    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
  });

  it('hides a technical-ID email and shows the inbox name instead', async () => {
    const contact = fakeContact({
      email: '0284275482624:20d315f4-2b1c',
      contactInboxes: [
        { channel: 'webchat', inbox: { name: 'AhaChat Inbox' } },
      ] as unknown as ContactListItem['contactInboxes'],
    });
    await render(<ContactRow contact={contact} workspaceId="ws-1" onPress={() => {}} />);

    expect(screen.queryByText('0284275482624:20d315f4-2b1c')).toBeNull();
    expect(screen.getByText('AhaChat Inbox')).toBeTruthy();
  });

  it('calls onPress with the contact when the row is tapped', async () => {
    const onPress = jest.fn();
    const contact = fakeContact();
    await render(<ContactRow contact={contact} workspaceId="ws-1" onPress={onPress} />);

    fireEvent.press(screen.getByLabelText(/Jane Doe/));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(contact);
  });

  it('paints the surface background so the row matches the list', async () => {
    await render(<ContactRow contact={fakeContact()} workspaceId="ws-1" onPress={() => {}} />);

    const style = screen.getByLabelText(/Jane Doe/).props.style;
    expect(JSON.stringify(style)).toContain('backgroundColor');
  });

  function actionNames(): string[] {
    const row = screen.getByLabelText(/Jane Doe/);
    return (row.props.accessibilityActions as { name: string }[]).map((action) => action.name);
  }

  it('exposes message and openActions actions when both callbacks are provided', async () => {
    await render(
      <ContactRow
        contact={fakeContact()}
        workspaceId="ws-1"
        onPress={() => {}}
        onMessage={() => {}}
        onOpenActions={() => {}}
      />,
    );

    expect(actionNames()).toEqual(['message', 'openActions']);
  });

  it('omits the message action when the contact has no conversation', async () => {
    await render(
      <ContactRow
        contact={fakeContact({ conversation: null } as Partial<ContactListItem>)}
        workspaceId="ws-1"
        onPress={() => {}}
        onMessage={() => {}}
        onOpenActions={() => {}}
      />,
    );

    expect(actionNames()).toEqual(['openActions']);
  });

  it('routes accessibility actions to the matching callbacks with the contact', async () => {
    const onMessage = jest.fn();
    const onOpenActions = jest.fn();
    const contact = fakeContact();
    await render(
      <ContactRow
        contact={contact}
        workspaceId="ws-1"
        onPress={() => {}}
        onMessage={onMessage}
        onOpenActions={onOpenActions}
      />,
    );

    const row = screen.getByLabelText(/Jane Doe/);
    row.props.onAccessibilityAction({ nativeEvent: { actionName: 'message' } });
    row.props.onAccessibilityAction({ nativeEvent: { actionName: 'openActions' } });
    expect(onMessage).toHaveBeenCalledWith(contact);
    expect(onOpenActions).toHaveBeenCalledWith(contact);
  });

  it('never exposes delete or block as accessibility actions', async () => {
    await render(
      <ContactRow
        contact={fakeContact()}
        workspaceId="ws-1"
        onPress={() => {}}
        onMessage={() => {}}
        onOpenActions={() => {}}
      />,
    );

    expect(actionNames()).not.toContain('delete');
    expect(actionNames()).not.toContain('block');
  });

  it('uses onLongPress over onOpenActions when both are provided', async () => {
    const onLongPress = jest.fn();
    const onOpenActions = jest.fn();
    await render(
      <ContactRow
        contact={fakeContact()}
        workspaceId="ws-1"
        onPress={() => {}}
        onLongPress={onLongPress}
        onOpenActions={onOpenActions}
      />,
    );

    fireEvent(screen.getByLabelText(/Jane Doe/), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onOpenActions).not.toHaveBeenCalled();
  });
});
