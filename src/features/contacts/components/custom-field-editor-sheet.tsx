import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  useDeleteContactField,
  useSetContactField,
  useWorkspaceCustomFields,
} from '@/features/contacts/api/use-contact-fields';
import { validateCustomFieldValue } from '@/features/contacts/lib/validate-custom-field-value';
import { describeApiError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

type CustomFieldCatalogEntry = { id: string; name: string; type: string };

/** Maps the custom-field catalog's `type` string to a leading glyph — mirrors web's
 * customFieldIconsMap. Falls back to `type` (a generic text-field glyph) for any type this map
 * doesn't recognize, rather than throwing. */
const FIELD_TYPE_ICONS: Record<string, IconName> = {
  shortText: 'type',
  longText: 'type',
  number: 'hash',
  date: 'calendar-days',
  datetime: 'calendar-clock',
  boolean: 'check',
  email: 'mail',
  phoneNumber: 'phone',
};

function iconForFieldType(type: string): IconName {
  return FIELD_TYPE_ICONS[type] ?? 'type';
}

function keyboardTypeForField(type: string | undefined): KeyboardTypeOptions {
  switch (type) {
    case 'number':
      return 'numbers-and-punctuation';
    case 'email':
      return 'email-address';
    case 'phoneNumber':
      return 'phone-pad';
    default:
      return 'default';
  }
}

interface CustomFieldEditorSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  contact: ContactDetail;
}

/** Catalog-list + value-editor pair extracted from `InfoTab`'s inline custom-field sheets — same
 * behavior (browse catalog → edit value in a modal → save/clear), now reusable from
 * `ContactActionsSheet`'s "Set custom field" entry as well as `InfoTab`'s own per-field pencil
 * icon and "Add custom field" row. `InfoTab` keeps rendering the field list inline; this owns
 * only the two sheets. */
export function CustomFieldEditorSheet({
  sheetRef,
  workspaceId,
  contact,
}: CustomFieldEditorSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const { data: catalog } = useWorkspaceCustomFields(workspaceId);
  const setField = useSetContactField(workspaceId, contact.id);
  const deleteField = useDeleteContactField(workspaceId, contact.id);

  const editorSheetRef = useRef<BottomSheetModal>(null);
  const [editingField, setEditingField] = useState<CustomFieldCatalogEntry | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSaving = setField.isPending || deleteField.isPending;

  const setFieldValues = new Map(contact.customFields.map((field) => [field.id, field.value]));

  function openEditor(field: CustomFieldCatalogEntry) {
    setEditingField(field);
    setSaveError(null);
    setDraftValue(setFieldValues.get(field.id) ?? '');
    sheetRef.current?.dismiss();
    editorSheetRef.current?.present();
  }

  function closeEditor() {
    editorSheetRef.current?.dismiss();
    setEditingField(null);
    setSaveError(null);
  }

  /** Keeps the editor open until the request succeeds; on failure the sheet stays up with the
   * server's message so the agent can correct the value (e.g. a wrong type for a number field). */
  async function saveDraft() {
    if (!editingField) return;
    const trimmed = draftValue.trim();
    const invalidType = validateCustomFieldValue(editingField.type, trimmed);
    if (invalidType) {
      setSaveError(t(`contacts.customFieldInvalid.${invalidType}`));
      return;
    }
    setSaveError(null);
    try {
      if (trimmed) {
        await setField.mutateAsync({ customFieldId: editingField.id, value: trimmed });
      } else if (setFieldValues.has(editingField.id)) {
        await deleteField.mutateAsync(editingField.id);
      }
      closeEditor();
    } catch (error) {
      setSaveError(describeApiError(error, t));
    }
  }

  return (
    <>
      <SheetModal ref={sheetRef} snapPoints={['50%', '80%']}>
        <SheetHeader
          title={t('contacts.setCustomField')}
          onClose={() => sheetRef.current?.dismiss()}
        />
        <BottomSheetFlatList
          data={(catalog ?? []) as CustomFieldCatalogEntry[]}
          keyExtractor={(field) => field.id}
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={setFieldValues.get(item.id)}
              leading={
                <Icon name={iconForFieldType(item.type)} size={20} color={colors.textSecondary} />
              }
              onPress={() => openEditor(item)}
            />
          )}
        />
      </SheetModal>

      <SheetModal ref={editorSheetRef} snapPoints={['40%']} onDismiss={() => setEditingField(null)}>
        <SheetHeader title={editingField?.name ?? ''} onClose={closeEditor} />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <BottomSheetTextInput
            value={draftValue}
            onChangeText={(text) => {
              setDraftValue(text);
              if (saveError) setSaveError(null);
            }}
            keyboardType={keyboardTypeForField(editingField?.type)}
            autoCapitalize="none"
            autoFocus
            style={{
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: 8,
              padding: 10,
              color: colors.textPrimary,
            }}
          />
          {saveError ? <ErrorBanner message={saveError} tone="danger" /> : null}
          <Button label={t('common.save')} onPress={saveDraft} loading={isSaving} fullWidth />
        </View>
      </SheetModal>
    </>
  );
}

export { iconForFieldType };
