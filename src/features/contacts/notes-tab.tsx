import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

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

/** Read-only — `contactNotes` (`{ id, text, createdAt, createdById }`) is embedded on the
 * contact-detail response, so no separate fetch is needed. Author name is resolved by matching
 * `createdById` against the workspace members list (shared with assignment-sheet's query), with a
 * generic fallback label for notes whose author is no longer a member or wasn't found. */
export function NotesTab({ contact, workspaceId }: NotesTabProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { data: members } = useWorkspaceMembersList(workspaceId ?? '');

  function authorName(createdById: string | null): string {
    if (!createdById) return t('contacts.unknownAuthor');
    const member = members?.find((m) => m.userId === createdById);
    return member?.user.name ?? t('contacts.unknownAuthor');
  }

  if (contact.contactNotes.length === 0) {
    return <EmptyState icon="file-text" title={t('contacts.noNotes')} />;
  }

  const sortedNotes = [...contact.contactNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      {sortedNotes.map((note) => (
        <Card key={note.id} padding="md" style={styles.card}>
          <View style={[styles.header, { gap: spacing.xs }]}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.authorName}>
              {authorName(note.createdById)}
            </Text>
            <RelativeTime date={note.createdAt} />
          </View>
          <Text variant="body" color="secondary">
            {note.text}
          </Text>
        </Card>
      ))}
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
