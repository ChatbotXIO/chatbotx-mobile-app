import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/theme/use-theme';

import { botState } from '../lib/conversation-status';

interface BotStateIconProps {
  botEnabled: boolean;
  botResumeAt: string | null;
  size?: number;
}

/** Tri-state bot indicator: on (`bot`, brand-tinted), paused (`clock`, warning-tinted, a11y label
 * carries the resume time), off (`bot-off`, muted). See `botState()` for the state derivation. */
export function BotStateIcon({ botEnabled, botResumeAt, size = 16 }: BotStateIconProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = botState(botEnabled, botResumeAt);

  const config = {
    on: {
      icon: 'bot' as const,
      color: colors.bubbleBotAccent,
      label: t('conversations.botActive'),
    },
    paused: {
      icon: 'clock' as const,
      color: colors.warning,
      label: botResumeAt
        ? t('conversations.botResumesAt', { time: new Date(botResumeAt).toLocaleTimeString() })
        : t('conversations.botPaused'),
    },
    off: {
      icon: 'bot-off' as const,
      color: colors.textTertiary,
      label: t('conversations.botOff'),
    },
  }[state];

  return (
    <View accessibilityLabel={config.label} accessible>
      <Icon name={config.icon} size={size} color={config.color} />
    </View>
  );
}

interface AssigneeBadgeProps {
  assignedUser?: { name: string | null } | null;
  assignedInboxTeam?: { name: string } | null;
  size?: number;
}

/** Small corner badge for the row avatar: initials avatar for a person, `users-round` glyph for a
 * team, nothing when unassigned. Mirrors web's corner-avatar assignee treatment. */
export function AssigneeBadge({ assignedUser, assignedInboxTeam, size = 18 }: AssigneeBadgeProps) {
  const { colors } = useTheme();

  if (assignedUser?.name) {
    return <Avatar name={assignedUser.name} size={size} />;
  }
  if (assignedInboxTeam) {
    return (
      <View
        style={[
          styles.teamBadge,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2 },
        ]}
      >
        <Icon name="users-round" size={size - 6} color={colors.textSecondary} />
      </View>
    );
  }
  return null;
}

interface StatusIconStripProps {
  followed: boolean;
  archivedAt: string | null;
  blockedAt?: string | null;
  unread: boolean;
  size?: number;
}

/** Compact icon-only status row replacing the previous text-chip strip: followed star, archived
 * box, blocked lock, unread mail — each rendered only when true. */
export function StatusIconStrip({
  followed,
  archivedAt,
  blockedAt,
  unread,
  size = 14,
}: StatusIconStripProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (!followed && !archivedAt && !blockedAt && !unread) return null;

  return (
    <View style={[styles.strip, { gap: spacing.xs }]}>
      {followed ? (
        <View accessibilityLabel={t('conversations.follow')} accessible>
          <Icon name="star" size={size} color={colors.warning} filled />
        </View>
      ) : null}
      {archivedAt ? (
        <View accessibilityLabel={t('conversations.archive')} accessible>
          <Icon name="archive" size={size} color={colors.textTertiary} />
        </View>
      ) : null}
      {blockedAt ? (
        <View accessibilityLabel={t('conversations.statusBlocked')} accessible>
          <Icon name="user-lock" size={size} color={colors.danger} />
        </View>
      ) : null}
      {unread ? (
        <View accessibilityLabel={t('conversations.statusUnread')} accessible>
          <Icon name="mail" size={size} color={colors.brand} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  teamBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
