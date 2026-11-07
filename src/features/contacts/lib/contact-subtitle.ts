import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';
import { maskEmail, maskPhone } from '@/features/contacts/pii-mask';

// Lightweight shape checks, not full validation: guest contacts often carry a technical
// identifier (e.g. `0284275482624:20d315f4-…`) in the email/phone slot, which is meaningless to a
// person and must not be shown as a subtitle.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s-]{6,}$/;

/** Second line of a contact row: a valid email, else a valid phone (both masked unless the member
 * may see PII), else the first inbox's name, else nothing. */
export function contactSubtitle(contact: ContactListItem, canSeePii: boolean): string | undefined {
  if (contact.email && EMAIL_PATTERN.test(contact.email)) {
    return canSeePii ? contact.email : maskEmail(contact.email);
  }
  if (contact.phoneNumber && PHONE_PATTERN.test(contact.phoneNumber)) {
    return canSeePii ? contact.phoneNumber : maskPhone(contact.phoneNumber);
  }
  return contact.contactInboxes?.[0]?.inbox?.name || undefined;
}

/** Most meaningful "last seen" timestamp available on a list row. */
export function contactLastActivityAt(contact: ContactListItem): string | null {
  return (
    contact.conversation?.lastActivityAt ??
    contact.contactInboxes?.[0]?.lastIncomingMessageAt ??
    contact.updatedAt ??
    null
  );
}
