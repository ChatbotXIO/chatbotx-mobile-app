import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface DateSeparatorProps {
  /** ISO date string (or anything dayjs can parse). */
  date: string;
}

/** Centered pill label for message-list date breaks: "Today" / "Yesterday" / a localized date for
 * anything older. */
export function DateSeparator({ date }: DateSeparatorProps) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();

  const target = dayjs(date);
  const today = dayjs();
  const isToday = target.isSame(today, 'day');
  const isYesterday = target.isSame(today.subtract(1, 'day'), 'day');
  const isSameYear = target.isSame(today, 'year');

  const label = isToday
    ? t('common.today', { defaultValue: 'Today' })
    : isYesterday
      ? t('common.yesterday', { defaultValue: 'Yesterday' })
      : target.format(isSameYear ? 'MMMM D' : 'MMMM D, YYYY');

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.surface1,
            borderRadius: radius.full,
            paddingHorizontal: spacing.ms,
            paddingVertical: spacing.xs,
          },
        ]}
      >
        <Text variant="micro" color="secondary" style={styles.label}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    width: '100%',
  },
  pill: {},
  label: {
    fontWeight: '600',
  },
});
