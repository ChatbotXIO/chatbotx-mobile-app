import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { FEATURES } from '@/config/features';
import { useEnrollContactInSequences } from '@/features/sequences/api/use-enroll-contact-in-sequences';
import { useSequences, type SequenceListItem } from '@/features/sequences/api/use-sequences';
import { useTheme } from '@/theme/use-theme';

interface SequencePickerSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  contactId: string;
  onEnrolled?: () => void;
}

/**
 * Multi-select sequence picker, opened from the contact detail Sequences tab's "Add to sequence"
 * button. When `FEATURES.sendSequence` is off, the sheet still opens (so the feature stays
 * discoverable) but every row renders disabled with a "Coming soon" badge, and selection/submit
 * are both no-ops.
 */
export function SequencePickerSheet({
  sheetRef,
  workspaceId,
  contactId,
  onEnrolled,
}: SequencePickerSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const showToast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: sequences, isLoading } = useSequences(workspaceId);
  const enroll = useEnrollContactInSequences(workspaceId, contactId);

  const activeSequences = (sequences ?? []).filter((sequence) => sequence.active);

  function toggle(sequenceId: string) {
    if (!FEATURES.sendSequence) return;
    setSelectedIds((prev) =>
      prev.includes(sequenceId) ? prev.filter((id) => id !== sequenceId) : [...prev, sequenceId],
    );
  }

  function handleConfirm() {
    if (!FEATURES.sendSequence || selectedIds.length === 0) return;
    enroll.mutate(selectedIds, {
      onSuccess: () => {
        showToast({ message: t('contacts.sequenceEnrolled'), tone: 'success' });
        setSelectedIds([]);
        onEnrolled?.();
        sheetRef.current?.dismiss();
      },
      onError: () => {
        showToast({ message: t('contacts.sequenceEnrollFailed'), tone: 'danger' });
      },
    });
  }

  return (
    <SheetModal ref={sheetRef} snapPoints={['60%', '90%']}>
      <SheetHeader
        title={t('contacts.addToSequence')}
        onClose={() => sheetRef.current?.dismiss()}
      />
      {!FEATURES.sendSequence ? (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          <Badge tone="warning">{t('common.comingSoon')}</Badge>
        </View>
      ) : null}
      <BottomSheetFlatList
        data={activeSequences}
        keyExtractor={(sequence) => sequence.id}
        ListEmptyComponent={
          !isLoading ? <EmptyState icon="layers-2" title={t('contacts.noActiveSequences')} /> : null
        }
        renderItem={({ item }: { item: SequenceListItem }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <ListItem
              title={item.name}
              subtitle={t('contacts.sequenceSubscribers', { count: item.subscribersCount })}
              disabled={!FEATURES.sendSequence}
              leading={
                <Icon
                  name={selected ? 'square-check' : 'square'}
                  size={22}
                  color={selected ? colors.brand : colors.textSecondary}
                />
              }
              trailing={
                !FEATURES.sendSequence ? (
                  <Badge tone="warning">{t('common.comingSoon')}</Badge>
                ) : undefined
              }
              accessibilityState={{ selected }}
              onPress={() => toggle(item.id)}
            />
          );
        }}
      />
      <View
        style={[
          styles.footer,
          { padding: spacing.md, gap: spacing.sm, borderTopColor: colors.borderSubtle },
        ]}
      >
        <Button
          label={t('contacts.enrollSelected', { count: selectedIds.length })}
          onPress={handleConfirm}
          disabled={!FEATURES.sendSequence || selectedIds.length === 0}
          loading={enroll.isPending}
          fullWidth
        />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
