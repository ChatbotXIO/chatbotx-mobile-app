import type BottomSheet from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ListItem } from '@/components/ui/list-item';
import { Sheet } from '@/components/ui/sheet';
import type { Message } from '@/features/chat/api/use-messages-infinite';

import { getOptimisticStatus } from './optimistic-message';

interface MessageActionsMenuProps {
  message: Message | null;
  onEdit: (message: Message) => void;
  onReply: (message: Message) => void;
  onDelete: (message: Message) => void;
  onLike: (message: Message) => void;
  onHide: (message: Message) => void;
  /** "Edit & resend" — restores the failed bubble's text to the draft and removes the failed
   * entry, distinct from the plain tap-to-retry on the bubble itself (avoids a duplicate-send if
   * the user both retries AND resends the restored draft). Only relevant/shown for a failed
   * optimistic bubble. */
  onEditAndResend: (message: Message) => void;
}

/** Long-press action sheet for a message: reply, edit (text messages from us only), delete, like,
 * hide, and — for a failed optimistic bubble specifically — "Edit & resend". `attributes.liked`/
 * `attributes.hidden` aren't strongly typed in the generated schema (loose JSON-value union), so
 * this always shows both toggle actions rather than trying to read current state from
 * `attributes` — the mutation itself is idempotent either way. */
export const MessageActionsMenu = forwardRef<BottomSheet, MessageActionsMenuProps>(
  function MessageActionsMenu(
    { message, onEdit, onReply, onDelete, onLike, onHide, onEditAndResend },
    ref,
  ) {
    const { t } = useTranslation();

    if (!message) {
      return (
        <Sheet ref={ref} snapPoints={['1%']}>
          <></>
        </Sheet>
      );
    }

    const optimistic = getOptimisticStatus(message);
    const isFailed = optimistic?.status === 'failed';
    const canEdit = !isFailed && message.senderType !== 'contact' && message.contentType === 'text';
    const canReply = !isFailed && !message.deletedAt;

    return (
      <Sheet ref={ref} snapPoints={['40%']}>
        {isFailed ? (
          <ListItem title={t('chat.editAndResend')} onPress={() => onEditAndResend(message)} />
        ) : null}
        {canReply ? <ListItem title={t('chat.reply')} onPress={() => onReply(message)} /> : null}
        {canEdit ? <ListItem title={t('chat.edit')} onPress={() => onEdit(message)} /> : null}
        {!isFailed ? <ListItem title={t('chat.like')} onPress={() => onLike(message)} /> : null}
        {!isFailed ? <ListItem title={t('chat.hide')} onPress={() => onHide(message)} /> : null}
        <ListItem title={t('chat.delete')} destructive onPress={() => onDelete(message)} />
      </Sheet>
    );
  },
);
