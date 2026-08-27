import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SectionHeader } from '@/components/ui/section-header';
import { Sheet, SheetHeader, SheetModal } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  useDeleteContactField,
  useSetContactField,
  useWorkspaceCustomFields,
} from '@/features/contacts/api/use-contact-fields';
import { usePermissions } from '@/features/permissions/use-permissions';
import { maskEmail, maskPhone } from '@/features/contacts/pii-mask';
import { useTheme } from '@/theme/use-theme';

interface InfoTabProps {
  contact: ContactDetail;
  workspaceId: string | null;
}

function Field({ label, value }: { label: string; value: string | null }) {
  const { spacing } = useTheme();
  if (!value) return null;
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

type CustomFieldCatalogEntry = { id: string; name: string; type: string };

/**
 * Standard fields + `customFields` (embedded on the contact-detail response — see
 * use-contact-detail.ts), rendered inline (no own scroll container — `ContactPanel` owns the
 * single scroll surface all tabs render into). Email/phone are masked when the signed-in member
 * lacks the `emailAndPhone` permission bit. Custom-field values are editable via a `SheetModal`
 * (portaled above everything, including the tab bar) rather than the previous hand-rolled
 * absolutely-positioned overlay containing a `BottomSheetTextInput` outside any real sheet.
 */
export function InfoTab({ contact, workspaceId }: InfoTabProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const permissions = usePermissions(workspaceId);
  const canSeePii = permissions.canSeeEmailAndPhone;

  const { data: catalog } = useWorkspaceCustomFields(workspaceId);
  const setField = useSetContactField(workspaceId ?? '', contact.id);
  const deleteField = useDeleteContactField(workspaceId ?? '', contact.id);

  const catalogSheetRef = useRef<BottomSheet>(null);
  const editorSheetRef = useRef<BottomSheetModal>(null);
  const [editingField, setEditingField] = useState<CustomFieldCatalogEntry | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const setFieldValues = new Map(contact.customFields.map((field) => [field.id, field.value]));

  function openEditor(field: CustomFieldCatalogEntry) {
    setEditingField(field);
    setDraftValue(setFieldValues.get(field.id) ?? '');
    catalogSheetRef.current?.close();
    editorSheetRef.current?.present();
  }

  function closeEditor() {
    editorSheetRef.current?.dismiss();
    setEditingField(null);
  }

  function saveDraft() {
    if (!editingField) return;
    const trimmed = draftValue.trim();
    if (trimmed) {
      setField.mutate({ customFieldId: editingField.id, value: trimmed });
    } else if (setFieldValues.has(editingField.id)) {
      deleteField.mutate(editingField.id);
    }
    closeEditor();
  }

  return (
    <View>
      <Field
        label={t('contacts.email')}
        value={contact.email ? (canSeePii ? contact.email : maskEmail(contact.email)) : null}
      />
      <Field
        label={t('contacts.phone')}
        value={
          contact.phoneNumber
            ? canSeePii
              ? contact.phoneNumber
              : maskPhone(contact.phoneNumber)
            : null
        }
      />
      <Field label={t('contacts.locale')} value={contact.locale} />
      <Field label={t('contacts.timezone')} value={contact.timezone} />
      <Field
        label={t('contacts.location')}
        value={[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || null}
      />

      <SectionHeader title={t('contacts.customFields')} />
      {contact.customFields.map((field) => (
        <ListItem
          key={field.id}
          title={field.name}
          subtitle={field.value}
          trailing={<Icon name="pencil-outline" size={18} color={colors.textSecondary} />}
          onPress={() => openEditor(field)}
        />
      ))}
      <ListItem
        title={t('contacts.addCustomField')}
        trailing={<Icon name="add-circle-outline" size={20} color={colors.primary} />}
        onPress={() => catalogSheetRef.current?.expand()}
      />

      <Sheet ref={catalogSheetRef} snapPoints={['50%', '80%']}>
        <BottomSheetFlatList
          data={(catalog ?? []) as CustomFieldCatalogEntry[]}
          keyExtractor={(field) => field.id}
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={setFieldValues.get(item.id)}
              onPress={() => openEditor(item)}
            />
          )}
        />
      </Sheet>

      <SheetModal ref={editorSheetRef} snapPoints={['40%']} onDismiss={() => setEditingField(null)}>
        <SheetHeader title={editingField?.name ?? ''} onClose={closeEditor} />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <BottomSheetTextInput
            value={draftValue}
            onChangeText={setDraftValue}
            autoFocus
            style={{
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: 8,
              padding: 10,
              color: colors.textPrimary,
            }}
          />
          <Button label={t('common.save')} onPress={saveDraft} fullWidth />
        </View>
      </SheetModal>
    </View>
  );
}
