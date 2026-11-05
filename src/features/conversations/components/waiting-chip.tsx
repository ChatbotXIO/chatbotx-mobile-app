import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatCompactDuration } from '@/lib/format-conversation-time';
import { useMinuteClock } from '@/lib/use-minute-clock';
import { useTheme } from '@/theme/use-theme';

interface WaitingChipProps {
  /** ISO timestamp from which the contact has been waiting on a human. */
  since: string;
  /** When set and already past, the chip turns to the danger tone (SLA breached). */
  slaBreachingAt: string | null;
}

/** Intercom-style "waiting" signal for agents: how long the contact has awaited a human reply,
 * escalating to danger once the response SLA is breaching. */
export function WaitingChip({ since, slaBreachingAt }: WaitingChipProps) {
  const { colors } = useTheme();
  const nowMs = useMinuteClock();
  const isBreaching = slaBreachingAt !== null && new Date(slaBreachingAt).getTime() <= nowMs;
  const tint = isBreaching ? colors.danger : colors.warning;
  const background = isBreaching ? colors.dangerSoft : colors.warningSoft;

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Icon name="clock" size={11} color={tint} />
      <Text variant="micro" style={{ color: tint }}>
        {formatCompactDuration(nowMs - new Date(since).getTime())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
