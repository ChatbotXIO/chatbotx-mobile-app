import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { isBotActive, isUnread } from '@/features/conversations/lib/conversation-status';
import { useTheme } from '@/theme/use-theme';

interface ConversationActionsSheetProps {
  /** The conversation the menu acts on; `null` before any row has been long-pressed. */
  conversation: ConversationListItem | null;
  onToggleRead: (conversation: ConversationListItem) => void;
  onToggleBot: (conversation: ConversationListItem) => void;
  onArchive: (conversation: ConversationListItem) => void;
  onAssign: (conversation: ConversationListItem) => void;
  /** Dismisses the sheet. Called after every action, and by the header close button. */
  onClose: () => void;
}

/**
 * Per-conversation overflow menu, opened by long-pressing (or the ⋯ button on) an inbox row.
 * Purely presentational: every item calls back to the screen, which owns the mutations and the
 * archive "Undo" toast. Labels flip with the conversation's current state (read/unread, bot
 * on/off, archived/active).
 */
export const ConversationActionsSheet = forwardRef<BottomSheetModal, ConversationActionsSheetProps>(
  function ConversationActionsSheet(
    { conversation, onToggleRead, onToggleBot, onArchive, onAssign, onClose },
    ref,
  ) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    const unread = conversation ? isUnread(conversation) : false;
    const botActive = conversation
      ? isBotActive(conversation.botEnabled, conversation.botResumeAt)
      : false;
    const isArchived = Boolean(conversation?.archivedAt);

    function run(action: (target: ConversationListItem) => void) {
      if (!conversation) return;
      onClose();
      action(conversation);
    }

    return (
      <SheetModal ref={ref} snapPoints={['45%']}>
        <SheetHeader title={t('conversations.actions')} onClose={onClose} />
        {conversation ? (
          <>
            <ListItem
              title={unread ? t('conversations.markRead') : t('conversations.markUnread')}
              leading={
                <Icon name={unread ? 'mail-open' : 'mail'} size={20} color={colors.textSecondary} />
              }
              onPress={() => run(onToggleRead)}
            />
            <ListItem
              title={botActive ? t('conversations.disableBot') : t('conversations.enableBot')}
              leading={
                <Icon name={botActive ? 'user' : 'bot'} size={20} color={colors.textSecondary} />
              }
              onPress={() => run(onToggleBot)}
            />
            <ListItem
              title={t('conversations.assign')}
              leading={<Icon name="user-plus" size={20} color={colors.textSecondary} />}
              onPress={() => run(onAssign)}
            />
            <ListItem
              title={isArchived ? t('conversations.unarchive') : t('conversations.archive')}
              destructive={!isArchived}
              leading={
                <Icon
                  name={isArchived ? 'archive-x' : 'archive'}
                  size={20}
                  color={isArchived ? colors.textSecondary : colors.danger}
                />
              }
              onPress={() => run(onArchive)}
            />
          </>
        ) : null}
      </SheetModal>
    );
  },
);
