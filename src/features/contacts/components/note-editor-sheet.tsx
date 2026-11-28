import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { MAX_NOTE_LENGTH } from '@/features/contacts/api/use-contact-notes';
import { useTheme } from '@/theme/use-theme';

interface NoteEditorSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Whether an existing note is being edited (vs. a new one created). */
  isEditing: boolean;
  text: string;
  onChangeText: (text: string) => void;
  isSaving: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onDismiss: () => void;
}

export function NoteEditorSheet({
  sheetRef,
  isEditing,
  text,
  onChangeText,
  isSaving,
  error,
  onSave,
  onDismiss,
}: NoteEditorSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const trimmed = text.trim();

  return (
    <SheetModal ref={sheetRef} snapPoints={['50%']} onDismiss={onDismiss}>
      <SheetHeader
        title={isEditing ? t('contacts.editNote') : t('contacts.addNote')}
        onClose={() => sheetRef.current?.dismiss()}
      />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        {error ? <ErrorBanner message={error} /> : null}
        <BottomSheetTextInput
          value={text}
          onChangeText={onChangeText}
          multiline
          maxLength={MAX_NOTE_LENGTH}
          autoFocus
          placeholder={t('contacts.notePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={{
            minHeight: 120,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: 8,
            padding: 12,
            color: colors.textPrimary,
            textAlignVertical: 'top',
          }}
        />
        <Button
          label={t('common.save')}
          disabled={trimmed.length === 0}
          loading={isSaving}
          onPress={() => onSave(trimmed)}
        />
      </View>
    </SheetModal>
  );
}
