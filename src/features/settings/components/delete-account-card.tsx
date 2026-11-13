import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Text } from '@/components/ui/text';
import { ACCOUNT_DELETE_URL } from '@/config/account-urls';
import { useTheme } from '@/theme/use-theme';

/** Warning block at the bottom of Settings. Account deletion is finished on the web, so this only
 * explains that and hands off to the browser. */
export function DeleteAccountCard() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.dangerSoft,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.danger,
        overflow: 'hidden',
      }}
    >
      <View style={[styles.notice, { padding: spacing.md, gap: spacing.ms }]}>
        <Icon name="triangle-alert" size={18} color={colors.danger} />
        <Text variant="caption" color="secondary" style={styles.noticeText}>
          {t('settings.deleteAccountWarning')}
        </Text>
      </View>
      <ListItem
        title={t('settings.deleteAccount')}
        onPress={() => void WebBrowser.openBrowserAsync(ACCOUNT_DELETE_URL)}
        showChevron
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
  noticeText: { flex: 1 },
});
