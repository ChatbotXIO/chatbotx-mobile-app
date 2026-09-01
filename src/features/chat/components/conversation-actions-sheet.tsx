import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeatureGatedListItem } from '@/components/ui/feature-gated-list-item';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { FEATURES } from '@/config/features';
import { useBlockContact, useUnblockContact } from '@/features/contacts/api/use-contact-block';
import { useDeleteContact } from '@/features/contacts/api/use-delete-contact';
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
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import { isBotActive } from '@/features/conversations/lib/conversation-status';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { describeApiError } from '@/lib/describe-api-error';
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
    const showToast = useToast();
    const assignmentSheetRef = useRef<BottomSheetModal>(null);
    // `AssignmentSheet` fires its own ungated `useWorkspaceMembersList` query on mount — mount it
    // only once "Assign" has been pressed at least once (matches the same lazy-mount fix applied
    // to `ContactActionsSheet`'s four child sheets). `pendingAssignmentRef` defers the `.present()`
    // call to the effect below since the ref is still null on the render that flips
    // `openedAssignment` to true (the sheet hasn't mounted yet). A ref (not state) so clearing it
    // doesn't itself trigger another render.
    const [openedAssignment, setOpenedAssignment] = useState(false);
    const pendingAssignmentRef = useRef(false);

    useEffect(() => {
      if (pendingAssignmentRef.current && openedAssignment) {
        assignmentSheetRef.current?.present();
        pendingAssignmentRef.current = false;
      }
    }, [openedAssignment]);

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
      confirmDestructive({
        title: isArchived ? t('conversations.unarchive') : t('conversations.archive'),
        message: isArchived
          ? t('conversations.unarchiveConfirm')
          : t('conversations.archiveConfirm'),
        cancelLabel: t('common.cancel', { defaultValue: 'Cancel' }),
        confirmLabel: isArchived ? t('conversations.unarchive') : t('conversations.archive'),
        onConfirm: () => {
          const mutation = isArchived ? unarchiveConversations : archiveConversations;
          mutation.mutate([conversationId], {
            onError: (error) => {
              showToast({ message: describeApiError(error, t), tone: 'danger' });
            },
          });
          onClose();
        },
      });
    }

    function handleToggleBlock() {
      if (!contactId) return;
      confirmDestructive({
        title: isBlocked ? t('contacts.unblock') : t('contacts.block'),
        message: isBlocked ? t('contacts.unblockConfirm') : t('contacts.blockConfirm'),
        cancelLabel: t('common.cancel', { defaultValue: 'Cancel' }),
        confirmLabel: isBlocked ? t('contacts.unblock') : t('contacts.block'),
        onConfirm: () => {
          if (!contactId) return;
          const mutation = isBlocked ? unblockContact : blockContact;
          mutation.mutate(contactId, {
            onSuccess: () => {
              showToast({
                message: isBlocked ? t('contacts.unblockedSuccess') : t('contacts.blockedSuccess'),
                tone: 'success',
              });
            },
            onError: (error) => {
              showToast({ message: describeApiError(error, t), tone: 'danger' });
            },
          });
          onClose();
        },
      });
    }

    function handleDeleteContact() {
      if (!contactId) return;
      confirmDestructive({
        title: t('contacts.deleteContact'),
        message: t('contacts.deleteConfirm'),
        cancelLabel: t('common.cancel', { defaultValue: 'Cancel' }),
        confirmLabel: t('contacts.deleteContact'),
        onConfirm: () => {
          deleteContact.mutate(contactId, {
            onSuccess: () => {
              showToast({ message: t('contacts.deleted'), tone: 'success' });
            },
            onError: (error) => {
              showToast({ message: describeApiError(error, t), tone: 'danger' });
            },
          });
          onClose();
        },
      });
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
              pendingAssignmentRef.current = true;
              setOpenedAssignment(true);
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
          <FeatureGatedListItem
            title={isBlocked ? t('contacts.unblock') : t('contacts.block')}
            icon={isBlocked ? 'user-check' : 'user-lock'}
            enabled={FEATURES.blockContact}
            onPress={handleToggleBlock}
          />
          <FeatureGatedListItem
            title={t('contacts.deleteContact')}
            icon="user-round-x"
            enabled={FEATURES.deleteContact}
            onPress={handleDeleteContact}
          />
        </SheetModal>
        {openedAssignment ? (
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
        ) : null}
      </>
    );
  },
);
