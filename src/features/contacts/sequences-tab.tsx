import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { useToast } from '@/components/ui/toast';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { useUnenrollContactFromSequences } from '@/features/sequences/api/use-unenroll-contact-from-sequences';
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
  const showToast = useToast();
  const pickerSheetRef = useRef<BottomSheetModal>(null);
  const unenroll = useUnenrollContactFromSequences(workspaceId ?? '', contact.id);

  function handleUnenroll(sequenceId: string, sequenceName: string) {
    confirmDestructive({
      title: t('contacts.unenrollSequence'),
      message: t('contacts.unenrollConfirm', { name: sequenceName }),
      confirmLabel: t('contacts.unenrollSequence'),
      cancelLabel: t('common.cancel'),
      onConfirm: () =>
        unenroll.mutate(sequenceId, {
          onSuccess: () =>
            showToast({ message: t('contacts.sequenceUnenrolled'), tone: 'success' }),
          onError: () =>
            showToast({ message: t('contacts.sequenceUnenrollFailed'), tone: 'danger' }),
        }),
    });
  }

  return (
    <View style={{ paddingBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Button
          label={t('contacts.addToSequence')}
          variant="tonal"
          icon="circle-plus"
          onPress={() => pickerSheetRef.current?.present()}
          disabled={!workspaceId}
        />
      </View>

      {contact.sequences.length === 0 ? (
        <EmptyState icon="layers-2" title={t('contacts.noSequences')} />
      ) : (
        contact.sequences.map((enrollment) => (
          <SwipeableRow
            key={enrollment.sequenceId}
            rightActions={
              workspaceId
                ? [
                    {
                      icon: 'circle-x',
                      label: t('contacts.unenrollSequence'),
                      color: colors.danger,
                      destructive: true,
                      onPress: () => handleUnenroll(enrollment.sequenceId, enrollment.sequenceName),
                    },
                  ]
                : undefined
            }
          >
            <View style={{ backgroundColor: colors.bg }}>
              <ListItem
                title={enrollment.sequenceName}
                leading={<Icon name="layers-2" size={20} color={colors.textSecondary} />}
              />
            </View>
          </SwipeableRow>
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
