import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { SwipeAction } from '@/components/ui/swipeable-row';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { Text } from '@/components/ui/text';
import { FEATURES } from '@/config/features';
import type { ContactListItem } from '@/features/contacts/api/use-contacts-infinite';
import { ContactStatusStrip } from '@/features/contacts/components/contact-status-icons';
import { usePermissions } from '@/features/permissions/use-permissions';
import { maskEmail, maskPhone } from '@/features/contacts/pii-mask';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import { useTheme } from '@/theme/use-theme';

interface ContactRowProps {
  contact: ContactListItem;
  workspaceId: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  onOpenActions?: () => void;
  onToggleBlock?: () => void;
  onDelete?: () => void;
}

/**
 * PII masking is gated on `usePermissions` — a member without `emailAndPhone` sees masked
 * email/phone here and in info-tab.tsx, not just a decorative blur.
 *
 * Swipe actions (block/unblock left, delete right) are flag-gated: while
 * `FEATURES.blockContact`/`FEATURES.deleteContact` are off, the corresponding swipe action is
 * OMITTED (not shown disabled) — matching the composer-sheet "omit rather than disable"
 * convention. The overflow sheet still lists both with a "Coming soon" badge so the feature stays
 * discoverable.
 */
export function ContactRow({
  contact,
  workspaceId,
  onPress,
  onLongPress,
  onOpenActions,
  onToggleBlock,
  onDelete,
}: ContactRowProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const permissions = usePermissions(workspaceId);
  const name = contact.fullName ?? contact.email ?? contact.phoneNumber ?? t('contacts.unknown');
  const canSeePii = permissions.canSeeEmailAndPhone;
  const subtitle = contact.email
    ? canSeePii
      ? contact.email
      : maskEmail(contact.email)
    : contact.phoneNumber
      ? canSeePii
        ? contact.phoneNumber
        : maskPhone(contact.phoneNumber)
      : undefined;

  const isBlocked = Boolean(contact.blockedAt);
  const channel = contact.contactInboxes?.[0]?.channel;

  const leftActions: SwipeAction[] | undefined =
    onToggleBlock && FEATURES.blockContact
      ? [
          {
            icon: isBlocked ? 'user-check' : 'user-lock',
            label: isBlocked ? t('contacts.unblock') : t('contacts.block'),
            color: colors.danger,
            destructive: !isBlocked,
            onPress: onToggleBlock,
          },
        ]
      : undefined;

  const rightActions: SwipeAction[] | undefined =
    onDelete && FEATURES.deleteContact
      ? [
          {
            icon: 'user-round-x',
            label: t('contacts.deleteContact'),
            color: colors.danger,
            destructive: true,
            onPress: onDelete,
          },
        ]
      : undefined;

  return (
    <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={onPress}
        onLongPress={onLongPress ?? onOpenActions}
        haptic={false}
        style={[
          styles.row,
          { paddingVertical: spacing.ms, paddingHorizontal: spacing.md, gap: spacing.ms },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            uri={contact.avatar}
            name={name}
            badge={channel ? <ChannelBadge channel={channel} size={12} /> : undefined}
          />
        </View>

        <View style={styles.body}>
          <Text variant="body" numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <ContactStatusStrip blockedAt={contact.blockedAt} tagCount={contact.tags?.length ?? 0} />
        </View>

        {onOpenActions ? (
          <IconButton
            accessibilityLabel={t('contacts.actions')}
            icon="ellipsis-vertical"
            size="sm"
            variant="ghost"
            onPress={onOpenActions}
          />
        ) : null}
      </PressableScale>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
