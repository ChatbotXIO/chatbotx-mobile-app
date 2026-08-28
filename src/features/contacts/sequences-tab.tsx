import type BottomSheet from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { RelativeTime } from '@/components/ui/relative-time';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { SequencePickerSheet } from '@/features/sequences/components/sequence-picker-sheet';
import { useTheme } from '@/theme/use-theme';

interface SequencesTabProps {
  contact: ContactDetail;
  workspaceId: string | null;
}

/**
 * `contactsOnSequences` embeds the full `sequence` object per enrollment, so no separate fetch is
 * needed for the read-only enrollment list below. No longer read-only overall, though: an "Add to
 * sequence" button opens `SequencePickerSheet` (flag-gated — see `src/config/features.ts` and
 * `sequence-picker-sheet.tsx`'s own "Coming soon" behavior while `FEATURES.sendSequence` is off).
 * Renders inline (no own scroll container — `ContactPanel` owns the single scroll surface).
 */
export function SequencesTab({ contact, workspaceId }: SequencesTabProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const pickerSheetRef = useRef<BottomSheet>(null);

  return (
    <View style={{ paddingBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Button
          label={t('contacts.addToSequence')}
          variant="tonal"
          icon="add-circle-outline"
          onPress={() => pickerSheetRef.current?.expand()}
          disabled={!workspaceId}
        />
      </View>

      {contact.contactsOnSequences.length === 0 ? (
        <EmptyState icon="git-network-outline" title={t('contacts.noSequences')} />
      ) : (
        contact.contactsOnSequences.map((enrollment) => (
          <View key={enrollment.sequenceId}>
            <ListItem
              title={enrollment.sequence.name}
              subtitle={t('contacts.sequenceStep', { step: enrollment.currentStep })}
              trailing={
                <Badge color={enrollment.completedAt ? colors.success : colors.surface2}>
                  {enrollment.completedAt
                    ? t('contacts.completed')
                    : (enrollment.status ?? t('contacts.active'))}
                </Badge>
              }
            />
            <RelativeTime date={enrollment.enrolledAt} />
          </View>
        ))
      )}

      {workspaceId ? (
        <SequencePickerSheet
          sheetRef={pickerSheetRef}
          workspaceId={workspaceId}
          contactId={contact.id}
        />
      ) : null}
    </View>
  );
}
