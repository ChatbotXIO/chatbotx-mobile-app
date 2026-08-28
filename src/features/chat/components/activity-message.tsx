import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { useTheme } from '@/theme/use-theme';

interface ActivityMessageProps {
  message: Message;
}

/** `messageType: "activity"` rows (assignment changes, archive, bot toggle, etc. surfaced as
 * inline timeline entries) — rendered centered and de-emphasized, not as a bubble. */
export function ActivityMessage({ message }: ActivityMessageProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: spacing.xs }]}>
      <Text variant="caption" color="secondary" style={styles.text}>
        {message.text ?? t('chat.activityFallback')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
