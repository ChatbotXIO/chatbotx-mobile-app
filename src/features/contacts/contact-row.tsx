import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/avatar';
import { ListItem } from '@/components/ui/list-item';
import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';
import { usePermissions } from '@/features/permissions/use-permissions';
import { maskEmail, maskPhone } from '@/features/contacts/pii-mask';

interface ContactRowProps {
  contact: ContactListItem;
  workspaceId: string | null;
  onPress: () => void;
}

/** PII masking is gated on `usePermissions` — a member without `emailAndPhone` sees masked
 * email/phone here and in info-tab.tsx, not just a decorative blur. */
export function ContactRow({ contact, workspaceId, onPress }: ContactRowProps) {
  const { t } = useTranslation();
  const permissions = usePermissions(workspaceId);
  const name = contact.fullName ?? contact.email ?? contact.phoneNumber ?? t('contacts.unknown');
  const canSeePii = permissions.canSeeEmailAndPhone;
  const subtitle = contact.email
    ? canSeePii
      ? contact.email
      : maskEmail(contact.email)
    : contact.phoneNumber
      ? canSeePii
        ? contact.phoneNumber
        : maskPhone(contact.phoneNumber)
      : undefined;

  return (
    <ListItem
      title={name}
      subtitle={subtitle}
      leading={<Avatar uri={contact.avatar} name={name} />}
      onPress={onPress}
      showChevron
    />
  );
}
