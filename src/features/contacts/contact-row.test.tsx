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
    contactInboxes: [{ channel: 'whatsapp' }],
    tags: [],
    ...overrides,
  } as unknown as ContactListItem;
}

describe('ContactRow', () => {
  it('renders the contact name and subtitle', async () => {
    await render(<ContactRow contact={fakeContact()} workspaceId="ws-1" onPress={() => {}} />);

    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
  });

  it('calls onPress when the row is tapped', async () => {
    const onPress = jest.fn();
    await render(<ContactRow contact={fakeContact()} workspaceId="ws-1" onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('Jane Doe'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders an ellipsis button that calls onOpenActions when provided', async () => {
    const onOpenActions = jest.fn();
    await render(
      <ContactRow
        contact={fakeContact()}
        workspaceId="ws-1"
        onPress={() => {}}
        onOpenActions={onOpenActions}
      />,
    );

    fireEvent.press(screen.getByLabelText('Contact actions'));
    expect(onOpenActions).toHaveBeenCalledTimes(1);
  });

  it('does not render an ellipsis button when onOpenActions is not provided', async () => {
    await render(<ContactRow contact={fakeContact()} workspaceId="ws-1" onPress={() => {}} />);

    expect(screen.queryByLabelText('Contact actions')).toBeNull();
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

    fireEvent(screen.getByLabelText('Jane Doe'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onOpenActions).not.toHaveBeenCalled();
  });
});
