import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SectionHeader } from '@/components/ui/section-header';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  useAddContactTag,
  useRemoveContactTag,
  useWorkspaceTags,
} from '@/features/contacts/api/use-contact-tags';
import { useTheme } from '@/theme/use-theme';

interface TagsTabProps {
  contact: ContactDetail;
  workspaceId: string;
}

/**
 * `contact.tags` comes embedded from useContactDetail — these are real workspace tags, distinct
 * from any derived status indicators (e.g. unread/followUp) shown elsewhere in the app, which are
 * computed client-side rather than stored as tags — the conversations-list response has no `tags`
 * field at all (confirmed against the schema), so there is nothing to keep in sync with the inbox.
 *
 * Renders inline (no own scroll/list container — `ContactPanel` owns the single scroll surface).
 * Assigned tags render as removable `Chip`s (optimistic add/remove — see use-contact-tags.ts).
 */
export function TagsTab({ contact, workspaceId }: TagsTabProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { data: catalog } = useWorkspaceTags(workspaceId);
  const addTag = useAddContactTag(workspaceId, contact.id);
  const removeTag = useRemoveContactTag(workspaceId, contact.id);

  const assignedIds = new Set(contact.tags.map((tag) => tag.id));
  const available = (catalog ?? []).filter((tag) => !assignedIds.has(tag.id));

  return (
    <View style={styles.container}>
      <SectionHeader title={t('contacts.assignedTags')} />
      {contact.tags.length === 0 ? (
        <EmptyState icon="tag" title={t('contacts.noTags')} />
      ) : (
        <View style={[styles.chipRow, { paddingHorizontal: spacing.md, gap: spacing.xs }]}>
          {contact.tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              tone="brand"
              leading="tag"
              onRemove={() => removeTag.mutate(tag.id)}
            />
          ))}
        </View>
      )}

      {available.length > 0 ? (
        <>
          <SectionHeader title={t('contacts.addTag')} />
          {available.map((item) => (
            <ListItem
              key={item.id}
              title={item.name}
              trailing={<Icon name="circle-plus" size={20} color={colors.brand} />}
              onPress={() => addTag.mutate(item)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
