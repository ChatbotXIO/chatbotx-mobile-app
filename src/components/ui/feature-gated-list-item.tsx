import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { useTheme } from '@/theme/use-theme';

interface FeatureGatedListItemProps {
  title: string;
  icon: IconName;
  /** Whether the underlying feature flag is on. While `false`, the row shows a "Coming soon"
   * badge and is disabled — still listed (not hidden entirely) so the feature stays discoverable
   * before it ships. */
  enabled: boolean;
  onPress: () => void;
}

/** Destructive list-item row gated behind a feature flag — icon + danger tint + "Coming soon"
 * badge while `enabled` is false. Shared by every block/delete row across the contact and
 * conversation action sheets, which previously duplicated this exact `ListItem` + `Icon` +
 * `Badge` + `disabled` shape verbatim. */
export function FeatureGatedListItem({ title, icon, enabled, onPress }: FeatureGatedListItemProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ListItem
      title={title}
      leading={<Icon name={icon} size={20} color={colors.danger} />}
      trailing={enabled ? undefined : <Badge tone="neutral">{t('common.comingSoon')}</Badge>}
      destructive
      disabled={!enabled}
      onPress={onPress}
    />
  );
}
