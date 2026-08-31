import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { FEATURES } from '@/config/features';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import {
  useArchiveConversations,
  useAssignConversations,
  useDisableBot,
  useEnableBot,
  useFollowConversation,
  useMarkConversationUnread,
  useUnarchiveConversations,
  useUnfollowConversation,
} from '@/features/conversations/api/use-conversation-actions';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { isBotActive } from '@/features/conversations/lib/conversation-status';
import { useBlockContact, useUnblockContact } from '@/features/contacts/api/use-contact-block';
import { useDeleteContact } from '@/features/contacts/api/use-delete-contact';
import { useTheme } from '@/theme/use-theme';

interface ConversationActionsSheetProps {
  workspaceId: string;
  conversationId: string;
  conversation: ConversationListItem | undefined;
  onClose: () => void;
  /** Only passed from the chat header, where `useSendMessage` is already wired for this
   * conversation — the list-row sheet omits it entirely rather than showing it disabled. */
  onSendFlow?: () => void;
  onSavedReplies?: () => void;
}

/**
 * Single conversation menu used from: chat header ⋯, list row ⋯, list row long-press. Order
 * mirrors the web app's own menu, with mobile-only additions (bot toggle, send flow, saved
 * replies) marked in the source comments below. Block/delete are gated behind
 * `FEATURES.blockContact`/`FEATURES.deleteContact` (no session-auth backend route yet — see
 * use-contact-block.ts/use-delete-contact.ts) and show a "Coming soon" badge while off, so the
 * feature stays discoverable without functioning early.
 */
export const ConversationActionsSheet = forwardRef<BottomSheetModal, ConversationActionsSheetProps>(
  function ConversationActionsSheet(
    { workspaceId, conversationId, conversation, onClose, onSendFlow, onSavedReplies },
    ref,
  ) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const assignmentSheetRef = useRef<BottomSheetModal>(null);

    const enableBot = useEnableBot(workspaceId);
    const disableBot = useDisableBot(workspaceId);
    const followConversation = useFollowConversation(workspaceId);
    const unfollowConversation = useUnfollowConversation(workspaceId);
    const archiveConversations = useArchiveConversations(workspaceId);
    const unarchiveConversations = useUnarchiveConversations(workspaceId);
    const markUnread = useMarkConversationUnread(workspaceId);
    const assignConversations = useAssignConversations(workspaceId);
    const contactId = conversation?.contactId;
    const blockContact = useBlockContact(workspaceId);
    const unblockContact = useUnblockContact(workspaceId);
    const deleteContact = useDeleteContact(workspaceId);

    const botActive = conversation
      ? isBotActive(conversation.botEnabled, conversation.botResumeAt)
      : false;
    const isFollowed = Boolean(conversation?.followed);
    const isArchived = Boolean(conversation?.archivedAt);
    const isAssigned = Boolean(conversation?.assignedUser || conversation?.assignedInboxTeam);
    const isBlocked = Boolean(conversation?.contact?.blockedAt);
    const assigneeName = conversation?.assignedUser?.name;

    function handleToggleBot() {
      if (botActive) {
        disableBot.mutate([conversationId]);
      } else {
        enableBot.mutate([conversationId]);
      }
      onClose();
    }

    function handleToggleFollow() {
      if (isFollowed) {
        unfollowConversation.mutate(conversationId);
      } else {
        followConversation.mutate(conversationId);
      }
      onClose();
    }

    function handleUnassign() {
      if (!conversation?.contactId) return;
      assignConversations.mutate({ contactIds: [conversation.contactId], assignedId: null });
      onClose();
    }

    function handleMarkUnread() {
      markUnread.mutate(conversationId);
      onClose();
    }

    function handleViewContact() {
      onClose();
      router.push({
        pathname: '/(app)/conversations/[conversationId]/contact',
        params: { conversationId },
      });
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

    function handleToggleBlock() {
      if (!contactId) return;
      Alert.alert(
        isBlocked ? t('contacts.unblock') : t('contacts.block'),
        isBlocked ? t('contacts.unblockConfirm') : t('contacts.blockConfirm'),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: isBlocked ? t('contacts.unblock') : t('contacts.block'),
            style: 'destructive',
            onPress: () => {
              if (!contactId) return;
              if (isBlocked) {
                unblockContact.mutate(contactId);
              } else {
                blockContact.mutate(contactId);
              }
              onClose();
            },
          },
        ],
      );
    }

    function handleDeleteContact() {
      if (!contactId) return;
      Alert.alert(t('contacts.deleteContact'), t('contacts.deleteConfirm'), [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('contacts.deleteContact'),
          style: 'destructive',
          onPress: () => {
            deleteContact.mutate(contactId);
            onClose();
          },
        },
      ]);
    }

    return (
      <>
        <SheetModal ref={ref} snapPoints={['70%']} onDismiss={onClose}>
          <SheetHeader title={t('conversations.actions')} onClose={onClose} />
          {/* mobile-only: bot toggle */}
          <ListItem
            title={botActive ? t('conversations.disableBot') : t('conversations.enableBot')}
            subtitle={botActive ? t('conversations.disableBotHint') : undefined}
            leading={
              <Icon name={botActive ? 'bot' : 'user'} size={20} color={colors.bubbleBotAccent} />
            }
            onPress={handleToggleBot}
          />
          <ListItem
            title={isFollowed ? t('conversations.unfollow') : t('conversations.follow')}
            leading={
              <Icon
                name={isFollowed ? 'star' : 'star-off'}
                size={20}
                color={colors.textSecondary}
                filled={isFollowed}
              />
            }
            onPress={handleToggleFollow}
          />
          <ListItem
            title={t('conversations.assign')}
            subtitle={assigneeName ?? undefined}
            leading={<Icon name="user-plus" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              assignmentSheetRef.current?.present();
            }}
          />
          {isAssigned ? (
            <ListItem
              title={t('conversations.unassign')}
              leading={<Icon name="user-minus" size={20} color={colors.textSecondary} />}
              onPress={handleUnassign}
            />
          ) : null}
          <ListItem
            title={t('conversations.markUnread')}
            leading={<Icon name="mail" size={20} color={colors.textSecondary} />}
            onPress={handleMarkUnread}
          />
          {/* mobile-only: send flow, saved replies — only when opened from a chat context */}
          {onSendFlow ? (
            <ListItem
              title={t('chat.sendFlow')}
              leading={<Icon name="workflow" size={20} color={colors.textSecondary} />}
              onPress={() => {
                onClose();
                onSendFlow();
              }}
            />
          ) : null}
          {onSavedReplies ? (
            <ListItem
              title={t('chat.savedReplies')}
              leading={<Icon name="message-square-more" size={20} color={colors.textSecondary} />}
              onPress={() => {
                onClose();
                onSavedReplies();
              }}
            />
          ) : null}
          <ListItem
            title={t('contacts.contactTitle')}
            leading={<Icon name="user" size={20} color={colors.textSecondary} />}
            onPress={handleViewContact}
          />
          <ListItem
            title={isArchived ? t('conversations.unarchive') : t('conversations.archive')}
            leading={
              <Icon name={isArchived ? 'archive-x' : 'archive'} size={20} color={colors.danger} />
            }
            destructive
            onPress={handleArchive}
          />
          <ListItem
            title={isBlocked ? t('contacts.unblock') : t('contacts.block')}
            leading={
              <Icon name={isBlocked ? 'user-check' : 'user-lock'} size={20} color={colors.danger} />
            }
            trailing={
              FEATURES.blockContact ? undefined : (
                <Badge tone="neutral">{t('common.comingSoon')}</Badge>
              )
            }
            destructive
            disabled={!FEATURES.blockContact}
            onPress={handleToggleBlock}
          />
          <ListItem
            title={t('contacts.deleteContact')}
            leading={<Icon name="user-round-x" size={20} color={colors.danger} />}
            trailing={
              FEATURES.deleteContact ? undefined : (
                <Badge tone="neutral">{t('common.comingSoon')}</Badge>
              )
            }
            destructive
            disabled={!FEATURES.deleteContact}
            onPress={handleDeleteContact}
          />
        </SheetModal>
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
