import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationDetail } from '@/features/conversations/api/use-conversation-detail';
import { ContactPanel } from '@/features/contacts/contact-panel';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/** Keyed by conversationId, so resolves contactId via the conversation-detail fetch before
 * handing off to the shared ContactPanel. */
export default function ConversationContactScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { spacing } = useTheme();
  const { data: conversation, isLoading } = useConversationDetail(
    workspaceId,
    conversationId ?? null,
  );

  if (isLoading || !conversation) {
    // Matches ContactPanel's own loading shape (see contact-panel.tsx) — this gate sits in front
    // of it, resolving `contactId` via the conversation-detail fetch, so the two loading states
    // should look identical rather than swap shapes mid-load.
    return (
      <Screen padded>
        <Skeleton height={72} borderRadius={36} style={{ alignSelf: 'center' }} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={16} />
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
