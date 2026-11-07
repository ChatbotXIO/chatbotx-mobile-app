import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';

import { contactLastActivityAt, contactSubtitle } from './contact-subtitle';

function fakeContact(overrides: Partial<ContactListItem> = {}): ContactListItem {
  return {
    id: 'contact-1',
    fullName: 'Jane Doe',
    email: null,
    phoneNumber: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    contactInboxes: [],
    ...overrides,
  } as unknown as ContactListItem;
}

describe('contactSubtitle', () => {
  it('returns a valid email as-is when PII is visible', () => {
    const contact = fakeContact({ email: 'jane@example.com' });
    expect(contactSubtitle(contact, true)).toBe('jane@example.com');
  });

  it('masks a valid email when PII is hidden', () => {
    const contact = fakeContact({ email: 'jane@example.com' });
    const subtitle = contactSubtitle(contact, false);
    expect(subtitle).not.toBe('jane@example.com');
    expect(subtitle).toContain('@');
  });

  it('falls back to the phone number when the email is not valid', () => {
    const contact = fakeContact({
      email: '0284275482624:20d315f4-abc',
      phoneNumber: '+84 912 345 678',
    });
    expect(contactSubtitle(contact, true)).toBe('+84 912 345 678');
  });

  it('masks a valid phone number when PII is hidden', () => {
    const contact = fakeContact({ phoneNumber: '+84912345678' });
    const subtitle = contactSubtitle(contact, false);
    expect(subtitle).not.toBe('+84912345678');
  });

  it('hides technical IDs and falls back to the inbox name', () => {
    const contact = fakeContact({
      email: '0284275482624:20d315f4-2b1c',
      phoneNumber: 'abc',
      contactInboxes: [
        { inbox: { name: 'AhaChat Inbox' } },
      ] as unknown as ContactListItem['contactInboxes'],
    });
    expect(contactSubtitle(contact, true)).toBe('AhaChat Inbox');
  });

  it('returns undefined when nothing is displayable', () => {
    expect(contactSubtitle(fakeContact(), true)).toBeUndefined();
  });
});

describe('contactLastActivityAt', () => {
  it('prefers the conversation last activity', () => {
    const contact = fakeContact({
      conversation: { lastActivityAt: '2026-03-01T00:00:00.000Z' },
      contactInboxes: [
        { lastIncomingMessageAt: '2026-02-01T00:00:00.000Z' },
      ] as unknown as ContactListItem['contactInboxes'],
    } as unknown as Partial<ContactListItem>);
    expect(contactLastActivityAt(contact)).toBe('2026-03-01T00:00:00.000Z');
  });

  it('falls back to the last incoming message, then updatedAt', () => {
    const withIncoming = fakeContact({
      contactInboxes: [
        { lastIncomingMessageAt: '2026-02-01T00:00:00.000Z' },
      ] as unknown as ContactListItem['contactInboxes'],
    });
    expect(contactLastActivityAt(withIncoming)).toBe('2026-02-01T00:00:00.000Z');
    expect(contactLastActivityAt(fakeContact())).toBe('2026-01-01T00:00:00.000Z');
  });
});
