import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/use-theme';

interface ContactStatusStripProps {
  blockedAt?: string | null;
  tagCount?: number;
}

/** Compact icon strip for contact rows/header: blocked lock, tag count. Each renders only when
 * its condition/value is truthy. */
export function ContactStatusStrip({ blockedAt, tagCount = 0 }: ContactStatusStripProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (!blockedAt && tagCount <= 0) return null;

  return (
    <View style={[styles.strip, { gap: spacing.xs }]}>
      {blockedAt ? (
        <View accessibilityLabel={t('contacts.blocked')} accessible>
          <Icon name="user-lock" size={14} color={colors.danger} />
        </View>
      ) : null}
      {tagCount > 0 ? (
        <View
          style={styles.tagGroup}
          accessibilityLabel={t('contacts.tagsCount', { count: tagCount })}
          accessible
        >
          <Icon name="tag" size={14} color={colors.textSecondary} />
          <Text variant="micro" color="tertiary">
            {tagCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
