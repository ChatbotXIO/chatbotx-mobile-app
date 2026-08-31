import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeatureGatedListItem } from '@/components/ui/feature-gated-list-item';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { FEATURES } from '@/config/features';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { useBlockContact, useUnblockContact } from '@/features/contacts/api/use-contact-block';
import { useDeleteContact } from '@/features/contacts/api/use-delete-contact';
import { CustomFieldEditorSheet } from '@/features/contacts/components/custom-field-editor-sheet';
import { TagPickerSheet } from '@/features/contacts/components/tag-picker-sheet';
import { useAssignConversations } from '@/features/conversations/api/use-conversation-actions';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import { SequencePickerSheet } from '@/features/sequences/components/sequence-picker-sheet';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { describeApiError } from '@/lib/describe-api-error';
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
    const showToast = useToast();

    const assignmentSheetRef = useRef<BottomSheetModal>(null);
    const tagPickerRef = useRef<BottomSheet>(null);
    const customFieldSheetRef = useRef<BottomSheetModal>(null);
    const sequencePickerRef = useRef<BottomSheetModal>(null);

    // Each child sheet mounts only once its row has been pressed at least once (see the
    // conditional rendering below) — each of these four sheets fires its own ungated `useQuery`
    // on mount (members, tags, custom fields, sequences respectively), so eagerly mounting all
    // four on every "⋯" open cost 4 fetches per open regardless of which (if any) row the user
    // actually picked. `pendingXRef` mirrors the contacts-screen "first tap is a no-op" fix: the
    // sheet's own ref is still null on the render that flips `openedX` to true (the sheet hasn't
    // mounted yet), so the actual `.present()/.expand()` call is deferred to the effect below,
    // which fires once the now-mounted sheet's ref is populated. A ref (not state) so clearing it
    // doesn't itself trigger another render.
    const [openedAssignment, setOpenedAssignment] = useState(false);
    const [openedTagPicker, setOpenedTagPicker] = useState(false);
    const [openedCustomField, setOpenedCustomField] = useState(false);
    const [openedSequencePicker, setOpenedSequencePicker] = useState(false);
    const pendingAssignmentRef = useRef(false);
    const pendingTagPickerRef = useRef(false);
    const pendingCustomFieldRef = useRef(false);
    const pendingSequencePickerRef = useRef(false);

    useEffect(() => {
      if (pendingAssignmentRef.current && openedAssignment) {
        assignmentSheetRef.current?.present();
        pendingAssignmentRef.current = false;
      }
    }, [openedAssignment]);

    useEffect(() => {
      if (pendingTagPickerRef.current && openedTagPicker) {
        tagPickerRef.current?.expand();
        pendingTagPickerRef.current = false;
      }
    }, [openedTagPicker]);

    useEffect(() => {
      if (pendingCustomFieldRef.current && openedCustomField) {
        customFieldSheetRef.current?.present();
        pendingCustomFieldRef.current = false;
      }
    }, [openedCustomField]);

    useEffect(() => {
      if (pendingSequencePickerRef.current && openedSequencePicker) {
        sequencePickerRef.current?.present();
        pendingSequencePickerRef.current = false;
      }
    }, [openedSequencePicker]);

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
      confirmDestructive({
        title: isBlocked ? t('contacts.unblock') : t('contacts.block'),
        message: isBlocked ? t('contacts.unblockConfirm') : t('contacts.blockConfirm'),
        cancelLabel: t('common.cancel', { defaultValue: 'Cancel' }),
        confirmLabel: isBlocked ? t('contacts.unblock') : t('contacts.block'),
        onConfirm: () => {
          const mutation = isBlocked ? unblockContact : blockContact;
          mutation.mutate(contact.id, {
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

    function handleDelete() {
      confirmDestructive({
        title: t('contacts.deleteContact'),
        message: t('contacts.deleteConfirm'),
        cancelLabel: t('common.cancel', { defaultValue: 'Cancel' }),
        confirmLabel: t('contacts.deleteContact'),
        onConfirm: () => {
          deleteContact.mutate(contact.id, {
            onSuccess: () => {
              showToast({ message: t('contacts.deleted'), tone: 'success' });
            },
            onError: (error) => {
              showToast({ message: describeApiError(error, t), tone: 'danger' });
            },
          });
          onClose();
          router.back();
        },
      });
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
              pendingAssignmentRef.current = true;
              setOpenedAssignment(true);
            }}
          />
          <ListItem
            title={t('contacts.setTags')}
            leading={<Icon name="tag" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              pendingTagPickerRef.current = true;
              setOpenedTagPicker(true);
            }}
          />
          <ListItem
            title={t('contacts.setCustomField')}
            leading={<Icon name="save" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              pendingCustomFieldRef.current = true;
              setOpenedCustomField(true);
            }}
          />
          <ListItem
            title={t('contacts.addToSequence')}
            leading={<Icon name="layers-2" size={20} color={colors.textSecondary} />}
            onPress={() => {
              onClose();
              pendingSequencePickerRef.current = true;
              setOpenedSequencePicker(true);
            }}
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
            onPress={handleDelete}
          />
        </Sheet>

        {openedAssignment ? (
          <AssignmentSheet
            sheetRef={assignmentSheetRef}
            workspaceId={workspaceId}
            onAssign={(userId) => {
              assignConversations.mutate({ contactIds: [contact.id], assignedId: userId });
            }}
          />
        ) : null}
        {openedTagPicker ? (
          <TagPickerSheet sheetRef={tagPickerRef} workspaceId={workspaceId} contact={contact} />
        ) : null}
        {openedCustomField ? (
          <CustomFieldEditorSheet
            sheetRef={customFieldSheetRef}
            workspaceId={workspaceId}
            contact={contact}
          />
        ) : null}
        {openedSequencePicker ? (
          <SequencePickerSheet
            sheetRef={sequencePickerRef}
            workspaceId={workspaceId}
            contactId={contact.id}
          />
        ) : null}
      </>
    );
  },
);
