import { StyleSheet, View } from 'react-native';

import { ListItem } from '@/components/ui/list-item';
import { useSavedReplies } from '@/features/chat/api/use-saved-replies';
import { useTheme } from '@/theme/use-theme';

const MAX_SUGGESTIONS = 4;

interface SavedReplySuggestionsProps {
  workspaceId: string;
  /** The composer draft; suggestions only render while it starts with "/". */
  draft: string;
  onSelect: (text: string) => void;
}

/** Typing "/" in the composer shows matching saved replies inline above the input (Slack/Intercom
 * style). Tapping one fills the draft so the agent can edit before sending. */
export function SavedReplySuggestions({
  workspaceId,
  draft,
  onSelect,
}: SavedReplySuggestionsProps) {
  const { colors, radius, spacing } = useTheme();
  const active = draft.startsWith('/');
  const { data: replies } = useSavedReplies(active ? workspaceId : '');

  if (!active) return null;

  const query = draft.slice(1).trim().toLowerCase();
  const matches = (replies ?? [])
    .filter((reply) => {
      const shortcut = reply.shortcut.replace(/^\//, '').toLowerCase();
      return query === '' || shortcut.includes(query);
    })
    .slice(0, MAX_SUGGESTIONS);

  if (matches.length === 0) return null;

  return (
    <View
      style={[
        styles.list,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.md,
          marginHorizontal: spacing.sm,
          marginTop: spacing.xs,
        },
      ]}
    >
      {matches.map((reply) => (
        <ListItem
          key={reply.id}
          title={reply.shortcut.startsWith('/') ? reply.shortcut : `/${reply.shortcut}`}
          subtitle={reply.text}
          onPress={() => onSelect(reply.text)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
