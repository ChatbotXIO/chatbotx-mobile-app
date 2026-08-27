import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { describeApiError } from '@/lib/describe-api-error';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamsList } from '@/features/settings/api/use-teams';
import { useWorkspaceMembersList } from '@/features/permissions/use-permissions';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/** Read-only members + teams screen (Phase 8). Teams is enterprise-tier and gracefully hides
 * itself on any fetch error (see use-teams.ts) rather than surfacing a broken state for
 * workspaces without the feature. */
export default function MembersScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId) ?? '';

  const membersQuery = useWorkspaceMembersList(workspaceId);
  const teamsQuery = useTeamsList(workspaceId);

  const members = membersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const showTeamsSection = !teamsQuery.isError && (teamsQuery.isPending || teams.length > 0);

  return (
    <Screen>
      <ScrollView>
        <SectionHeader title={t('settings.members')} />
        {membersQuery.isPending ? (
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : membersQuery.isError ? (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ErrorBanner
              message={describeApiError(membersQuery.error, t)}
              actionLabel={t('common.retry')}
              onAction={() => membersQuery.refetch()}
            />
          </View>
        ) : members.length === 0 ? (
          <EmptyState icon="people-outline" title={t('settings.noMembers')} />
        ) : (
          members.map((member) => (
            <ListItem
              key={member.id}
              title={member.user.name ?? t('contacts.unknown')}
              leading={<Avatar uri={member.user.image} name={member.user.name ?? '?'} />}
              trailing={
                <Badge>
                  {member.role === 'owner' ? t('settings.roleOwner') : t('settings.roleAgent')}
                </Badge>
              }
            />
          ))
        )}

        {showTeamsSection ? (
          <>
            <SectionHeader title={t('settings.teams')} />
            {teamsQuery.isPending ? (
              <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
                <Skeleton height={56} />
              </View>
            ) : teams.length === 0 ? (
              <EmptyState icon="people-circle-outline" title={t('settings.noTeams')} />
            ) : (
              teams.map((team) => (
                <ListItem
                  key={team.id}
                  title={team.name}
                  subtitle={`${team.inboxTeamMembers.length}`}
                />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
