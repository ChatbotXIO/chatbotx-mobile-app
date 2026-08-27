import { useLocalSearchParams } from 'expo-router';

import { ContactPanel } from '@/features/contacts/contact-panel';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/** Standalone contact detail, reached from the contacts-tab directory. Reuses the same panel as
 * the conversation-nested route (contact.tsx). */
export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  return (
    <ContactPanel workspaceId={workspaceId} contactId={contactId ?? null} origin="directory" />
  );
}
