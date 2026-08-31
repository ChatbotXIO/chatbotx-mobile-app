import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { FEATURES } from '@/config/features';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { useBlockContact, useUnblockContact } from '@/features/contacts/api/use-contact-block';
import { useDeleteContact } from '@/features/contacts/api/use-delete-contact';
import { CustomFieldEditorSheet } from '@/features/contacts/components/custom-field-editor-sheet';
import { TagPickerSheet } from '@/features/contacts/components/tag-picker-sheet';
import { useAssignConversations } from '@/features/conversations/api/use-conversation-actions';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import { SequencePickerSheet } from '@/features/sequences/components/sequence-picker-sheet';
import { useTheme } from '@/theme/use-theme';

interface ContactActionsSheetProps {
  workspaceId: string;
  contact: ContactDetail;
  /** Present only when this contact has an active conversation to jump to — omitted (not just
   * disabled) otherwise, matching the composer-sheet "omit rather than disable" convention. */
  conversationId?: string | null;
  onClose: () => void;
}

/**
 * Contact overflow menu, shared by the contact header ⋯ and each contact-row ⋯/long-press.
 * Message/Assign mirror the header's own CTAs; Set tags/Set custom field/Add to sequence open the
 * extracted picker sheets; Block/Delete are gated behind `FEATURES.blockContact`/
 * `FEATURES.deleteContact` with a "Coming soon" badge while off (see use-contact-block.ts /
 * use-delete-contact.ts for why — no session-auth backend route exists yet).
 */
export const ContactActionsSheet = forwardRef<BottomSheet, ContactActionsSheetProps>(
  function ContactActionsSheet({ workspaceId, contact, conversationId, onClose }, ref) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    const assignmentSheetRef = useRef<BottomSheetModal>(null);
    const tagPickerRef = useRef<BottomSheet>(null);
    const customFieldSheetRef = useRef<BottomSheetModal>(null);
    const sequencePickerRef = useRef<BottomSheetModal>(null);

    const assignConversations = useAssignConversations(workspaceId);
    const blockContact = useBlockContact(workspaceId);
    const unblockContact = useUnblockContact(workspaceId);
    const deleteContact = useDeleteContact(workspaceId);

    const isBlocked = Boolean(contact.blockedAt);

    function handleMessage() {
      onClose();
      if (conversationId) {
        router.push(`/(app)/conversations/${conversationId}`);
      }
    }

    function handleToggleBlock() {
      Alert.alert(
        isBlocked ? t('contacts.unblock') : t('contacts.block'),
        isBlocked ? t('contacts.unblockConfirm') : t('contacts.blockConfirm'),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: isBlocked ? t('contacts.unblock') : t('contacts.block'),
            style: 'destructive',
            onPress: () => {
              if (isBlocked) {
                unblockContact.mutate(contact.id);
              } else {
                blockContact.mutate(contact.id);
              }
              onClose();
            },
          },
        ],
      );
    }

    function handleDelete() {
      Alert.alert(t('contacts.deleteContact'), t('contacts.deleteConfirm'), [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('contacts.deleteContact'),
          style: 'destructive',
          onPress: () => {
            deleteContact.mutate(contact.id);
            onClose();
            router.back();
          },
        },
      ]);
    }

    return (
      <>
        <Sheet ref={ref} snapPoints={['60%']} onDismiss={onClose}>
          <SheetHeader title={t('contacts.actions')} onClose={onClose} />
          {conversationId ? (
            <ListItem
              title={t('contacts.message')}
              leading={<Icon name="message-circle" size={20} color={colors.textSecondary} />}
              onPress={handleMessage}
            />
          ) : null}
          <ListItem
            title={t('contacts.assign')}
            leading={<Icon name="user-plus" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              assignmentSheetRef.current?.present();
            }}
          />
          <ListItem
            title={t('contacts.setTags')}
            leading={<Icon name="tag" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              tagPickerRef.current?.expand();
            }}
          />
          <ListItem
            title={t('contacts.setCustomField')}
            leading={<Icon name="save" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              customFieldSheetRef.current?.present();
            }}
          />
          <ListItem
            title={t('contacts.addToSequence')}
            leading={<Icon name="layers-2" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              sequencePickerRef.current?.present();
            }}
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
            onPress={handleDelete}
          />
        </Sheet>

        <AssignmentSheet
          sheetRef={assignmentSheetRef}
          workspaceId={workspaceId}
          onAssign={(userId) => {
            assignConversations.mutate({ contactIds: [contact.id], assignedId: userId });
          }}
        />
        <TagPickerSheet sheetRef={tagPickerRef} workspaceId={workspaceId} contact={contact} />
        <CustomFieldEditorSheet
          sheetRef={customFieldSheetRef}
          workspaceId={workspaceId}
          contact={contact}
        />
        <SequencePickerSheet
          sheetRef={sequencePickerRef}
          workspaceId={workspaceId}
          contactId={contact.id}
        />
      </>
    );
  },
);
