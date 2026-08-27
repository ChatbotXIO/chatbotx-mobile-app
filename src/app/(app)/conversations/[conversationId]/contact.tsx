import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationDetail } from '@/features/conversations/api/use-conversation-detail';
import { ContactPanel } from '@/features/contacts/contact-panel';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

/** Replaces the Phase 4 minimal placeholder. Keyed by conversationId, so resolves contactId via
 * the conversation-detail fetch before handing off to the shared ContactPanel. */
export default function ConversationContactScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { data: conversation, isLoading } = useConversationDetail(
    workspaceId,
    conversationId ?? null,
  );

  if (isLoading || !conversation) {
    return (
      <Screen padded>
        <Skeleton height={72} borderRadius={36} style={{ alignSelf: 'center' }} />
      </Screen>
    );
  }

  return (
    <ContactPanel
      workspaceId={workspaceId}
      contactId={conversation.contactId}
      origin="conversation"
      channels={conversation.contactInboxes.map((inbox) => inbox.channel)}
      conversationId={conversation.id}
    />
  );
}
