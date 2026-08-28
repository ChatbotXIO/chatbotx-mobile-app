import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/theme/use-theme';

/**
 * The conversation-list response (schema.ts) has no dedicated free-form `tags` array on the
 * conversation item itself — the `status`/`tags` request filters share one enum
 * (noAdminReply|unread|followUp|archived|blocked). This component renders derived status chips
 * from that same vocabulary (computed by the caller from the conversation's own fields — e.g.
 * `followed`, `archivedAt`, `botEnabled` — see conversation-row.tsx), not a separate tags API.
 */
export type ConversationStatusChip =
  'noAdminReply' | 'unread' | 'followUp' | 'archived' | 'blocked';

const CHIP_LABEL_KEYS: Record<ConversationStatusChip, string> = {
  noAdminReply: 'conversations.statusNoAdminReply',
  unread: 'conversations.statusUnread',
  followUp: 'conversations.statusFollowUp',
  archived: 'conversations.statusArchived',
  blocked: 'conversations.statusBlocked',
};

interface TagChipsProps {
  chips: ConversationStatusChip[];
}

export function TagChips({ chips }: TagChipsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <Badge
          key={chip}
          color={
            chip === 'blocked' ? colors.danger : chip === 'unread' ? colors.brand : colors.surface2
          }
          textColor={
            chip === 'blocked' || chip === 'unread' ? colors.onBrand : colors.textSecondary
          }
        >
          {t(CHIP_LABEL_KEYS[chip])}
        </Badge>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
});
