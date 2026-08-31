import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  CustomFieldEditorSheet,
  iconForFieldType,
} from '@/features/contacts/components/custom-field-editor-sheet';
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

/**
 * Standard fields + `customFields` (embedded on the contact-detail response — see
 * use-contact-detail.ts), rendered inline (no own scroll container — `ContactPanel` owns the
 * single scroll surface all tabs render into). Email/phone are masked when the signed-in member
 * lacks the `emailAndPhone` permission bit. Custom-field values are editable via
 * `CustomFieldEditorSheet` (shared with `ContactActionsSheet`'s "Set custom field" entry).
 */
export function InfoTab({ contact, workspaceId }: InfoTabProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const permissions = usePermissions(workspaceId);
  const canSeePii = permissions.canSeeEmailAndPhone;

  const catalogSheetRef = useRef<BottomSheetModal>(null);

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
          leading={
            <Icon name={iconForFieldType(field.type)} size={18} color={colors.textSecondary} />
          }
          trailing={<Icon name="pencil" size={18} color={colors.textSecondary} />}
          onPress={() => catalogSheetRef.current?.present()}
        />
      ))}
      <ListItem
        title={t('contacts.addCustomField')}
        trailing={<Icon name="circle-plus" size={20} color={colors.brand} />}
        onPress={() => catalogSheetRef.current?.present()}
      />

      {workspaceId ? (
        <CustomFieldEditorSheet
          sheetRef={catalogSheetRef}
          workspaceId={workspaceId}
          contact={contact}
        />
      ) : null}
    </View>
  );
}
