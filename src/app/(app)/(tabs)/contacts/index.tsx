import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { ContactRow } from '@/features/contacts/contact-row';
import {
  flattenContactPages,
  useContactsInfinite,
} from '@/features/contacts/api/use-contacts-infinite';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [keyword, setKeyword] = useState('');

  const query = useContactsInfinite(workspaceId, keyword);
  const contacts = flattenContactPages(query.data?.pages);
  const normalizedError = query.error ? normalizeApiError(query.error) : null;

  if (normalizedError?.kind === 'workspaceBlocked') {
    return (
      <Screen edges={['top']}>
        <WorkspaceBlockedGate reason={normalizedError.reason} message={normalizedError.message} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
        <SearchBar value={keyword} onChangeText={setKeyword} placeholder={t('common.search')} />
      </View>

      {normalizedError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            message={describeApiError(query.error, t)}
            actionLabel={t('common.retry')}
            onAction={() => query.refetch()}
          />
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} height={56} />
          ))}
        </View>
      ) : contacts.length === 0 ? (
        <EmptyState icon="people-outline" title={t('contacts.empty')} />
      ) : (
        <FlashList
          data={contacts}
          keyExtractor={(contact) => contact.id}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              workspaceId={workspaceId}
              onPress={() => router.push(`/(app)/contacts/${item.id}`)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.brand}
            />
          }
          ListFooterComponent={<ListFooterSpinner visible={query.isFetchingNextPage} />}
        />
      )}
    </Screen>
  );
}
