import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { useToast } from '@/components/ui/toast';
import { useContactNoteMutations } from '@/features/contacts/api/use-contact-notes';
import { NoteEditorSheet } from '@/features/contacts/components/note-editor-sheet';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { describeApiError } from '@/lib/describe-api-error';

import { Card } from '@/components/ui/surface';
import { EmptyState } from '@/components/ui/empty-state';
import { RelativeTime } from '@/components/ui/relative-time';
import { Text } from '@/components/ui/text';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import { useWorkspaceMembersList } from '@/features/permissions/use-permissions';
import { useTheme } from '@/theme/use-theme';

interface NotesTabProps {
  contact: ContactDetail;
  workspaceId: string | null;
}

/** Add / edit / delete — `contactNotes` (`{ id, text, createdAt, createdById }`) is embedded on the
 * contact-detail response, so no separate fetch is needed. Author name is resolved by matching
 * `createdById` against the workspace members list (shared with assignment-sheet's query), with a
 * generic fallback label for notes whose author is no longer a member or wasn't found. */
export function NotesTab({ contact, workspaceId }: NotesTabProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { data: members } = useWorkspaceMembersList(workspaceId ?? '');
  const showToast = useToast();
  const editorRef = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<{ id: string | null; text: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { create, update, remove } = useContactNoteMutations(workspaceId ?? '', contact.id);

  function openEditor(note: { id: string; text: string } | null) {
    setSaveError(null);
    setEditing({ id: note?.id ?? null, text: note?.text ?? '' });
    editorRef.current?.present();
  }

  function handleSave(text: string) {
    const onSuccess = () => editorRef.current?.dismiss();
    const onError = (error: unknown) => setSaveError(describeApiError(error, t));
    if (editing?.id) {
      update.mutate({ noteId: editing.id, text }, { onSuccess, onError });
    } else {
      create.mutate(text, { onSuccess, onError });
    }
  }

  function handleDelete(noteId: string) {
    confirmDestructive({
      title: t('contacts.deleteNote'),
      message: t('contacts.deleteNoteConfirm'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () =>
        remove.mutate(noteId, {
          onError: (error) => showToast({ message: describeApiError(error, t), tone: 'danger' }),
        }),
    });
  }

  function authorName(createdById: string | null): string {
    if (!createdById) return t('contacts.unknownAuthor');
    const member = members?.find((m) => m.userId === createdById);
    return member?.user.name ?? t('contacts.unknownAuthor');
  }

  const sortedNotes = [...contact.contactNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <Button
        label={t('contacts.addNote')}
        variant="tonal"
        icon="circle-plus"
        disabled={!workspaceId}
        onPress={() => openEditor(null)}
      />
      {sortedNotes.length === 0 ? (
        <EmptyState icon="file-text" title={t('contacts.noNotes')} />
      ) : null}
      {sortedNotes.map((note) => (
        <Card key={note.id} padding="md" style={styles.card}>
          <View style={[styles.header, { gap: spacing.xs }]}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.authorName}>
              {authorName(note.createdById)}
            </Text>
            <RelativeTime date={note.createdAt} />
            {workspaceId ? (
              <>
                <IconButton
                  accessibilityLabel={t('contacts.editNote')}
                  icon="pencil"
                  size="sm"
                  variant="ghost"
                  onPress={() => openEditor(note)}
                />
                <IconButton
                  accessibilityLabel={t('contacts.deleteNote')}
                  icon="x"
                  size="sm"
                  variant="ghost"
                  onPress={() => handleDelete(note.id)}
                />
              </>
            ) : null}
          </View>
          <Text variant="body" color="secondary">
            {note.text}
          </Text>
        </Card>
      ))}
      <NoteEditorSheet
        sheetRef={editorRef}
        isEditing={Boolean(editing?.id)}
        text={editing?.text ?? ''}
        onChangeText={(text) => setEditing((prev) => ({ id: prev?.id ?? null, text }))}
        isSaving={create.isPending || update.isPending}
        error={saveError}
        onSave={handleSave}
        onDismiss={() => setEditing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    flex: 1,
  },
});
