import type { QueryClient } from '@tanstack/react-query';

import type {
  ContactListItem,
  ListContactsResponse,
} from '@/features/contacts/api/use-contacts-infinite';

/**
 * Scans every cached contacts-list infinite query (any keyword) for a row matching `contactId`.
 *
 * `useContactDetail`'s `getContactAuthenticatedAPI` response embeds `contactInboxes`, but
 * `conversation` and the channel order are optional there. This scan is a fallback that sources
 * them from whichever list page the user navigated from, mirroring
 * `find-conversation-in-cache.ts`'s approach on the conversations side. Falls back to `undefined`
 * on a cache miss (e.g. a cold deep link straight to a contact) — the header degrades gracefully
 * in that case ("Message" disabled).
 */
export function findContactInListCache(
  queryClient: QueryClient,
  workspaceId: string,
  contactId: string,
): ContactListItem | undefined {
  return queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        query.queryKey[0] === 'ws' &&
        query.queryKey[1] === workspaceId &&
        query.queryKey[2] === 'contacts' &&
        query.queryKey[3] === 'list',
    })
    .flatMap((query) => {
      const data = query.state.data as { pages: ListContactsResponse[] } | undefined;
      return data?.pages.flatMap((page) => page.data) ?? [];
    })
    .find((item) => item.id === contactId);
}
