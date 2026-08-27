import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import {
  useArchiveConversations,
  useAssignConversations,
  useFollowConversation,
  useMarkConversationUnread,
  useUnarchiveConversations,
  useUnfollowConversation,
} from '@/features/conversations/api/use-conversation-actions';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { useTheme } from '@/theme/use-theme';

interface ConversationActionsSheetProps {
  workspaceId: string;
  conversationId: string;
  conversation: ConversationListItem | undefined;
  onClose: () => void;
}

/** Chat header overflow menu: follow/unfollow, archive/unarchive (with confirm), mark unread,
 * assign (reuses the existing assignment-sheet.tsx), view contact. */
export const ConversationActionsSheet = forwardRef<BottomSheet, ConversationActionsSheetProps>(
  function ConversationActionsSheet({ workspaceId, conversationId, conversation, onClose }, ref) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const assignmentSheetRef = useRef<BottomSheet>(null);

    const followConversation = useFollowConversation(workspaceId);
    const unfollowConversation = useUnfollowConversation(workspaceId);
    const archiveConversations = useArchiveConversations(workspaceId);
    const unarchiveConversations = useUnarchiveConversations(workspaceId);
    const markUnread = useMarkConversationUnread(workspaceId);
    const assignConversations = useAssignConversations(workspaceId);

    const isFollowed = Boolean(conversation?.followed);
    const isArchived = Boolean(conversation?.archivedAt);

    function handleToggleFollow() {
      if (isFollowed) {
        unfollowConversation.mutate(conversationId);
      } else {
        followConversation.mutate(conversationId);
      }
      onClose();
    }

    function handleArchive() {
      Alert.alert(
        isArchived ? t('conversations.unarchive') : t('conversations.archive'),
        isArchived ? t('conversations.unarchiveConfirm') : t('conversations.archiveConfirm'),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: isArchived ? t('conversations.unarchive') : t('conversations.archive'),
            style: 'destructive',
            onPress: () => {
              if (isArchived) {
                unarchiveConversations.mutate([conversationId]);
              } else {
                archiveConversations.mutate([conversationId]);
              }
              onClose();
            },
          },
        ],
      );
    }

    function handleMarkUnread() {
      markUnread.mutate(conversationId);
      onClose();
    }

    function handleViewContact() {
      onClose();
      router.push(`/(app)/conversations/${conversationId}/contact` as never);
    }

    return (
      <>
        <Sheet ref={ref} snapPoints={['45%']} onDismiss={onClose}>
          <SheetHeader title={t('conversations.actions')} onClose={onClose} />
          <ListItem
            title={isFollowed ? t('conversations.unfollow') : t('conversations.follow')}
            leading={
              <Icon
                name={isFollowed ? 'star' : 'star-outline'}
                size={20}
                color={colors.textSecondary}
              />
            }
            onPress={handleToggleFollow}
          />
          <ListItem
            title={t('conversations.assign')}
            leading={<Icon name="person-add-outline" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              assignmentSheetRef.current?.expand();
            }}
          />
          <ListItem
            title={t('conversations.markUnread')}
            leading={<Icon name="mail-unread-outline" size={20} color={colors.textSecondary} />}
            onPress={handleMarkUnread}
          />
          <ListItem
            title={t('contacts.contactTitle')}
            leading={<Icon name="person-outline" size={20} color={colors.textSecondary} />}
            onPress={handleViewContact}
          />
          <ListItem
            title={isArchived ? t('conversations.unarchive') : t('conversations.archive')}
            leading={<Icon name="archive-outline" size={20} color={colors.danger} />}
            destructive
            onPress={handleArchive}
          />
        </Sheet>
        <AssignmentSheet
          sheetRef={assignmentSheetRef}
          workspaceId={workspaceId}
          onAssign={(userId) => {
            if (conversation?.contactId) {
              assignConversations.mutate({
                contactIds: [conversation.contactId],
                assignedId: userId,
              });
            }
          }}
        />
      </>
    );
  },
);
