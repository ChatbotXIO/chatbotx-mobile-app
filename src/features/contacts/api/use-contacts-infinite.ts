import { useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `contactsAPIs.listContactsAuthenticatedAPI` (`GET /workspaces/{workspaceId}/contacts`) uses
 * OFFSET pagination (`page`/`perPage`/`pageCount`/`totalCount`), NOT the cursor shape
 * (`{ data, nextCursor }`) every other list endpoint in this app uses — verified directly against
 * the generated schema. `api/pagination.ts`'s CursorPage helpers don't apply here; this hook
 * drives `useInfiniteQuery` with a page-number `pageParam` instead.
 *
 * KNOWN LIMITATION: unlike conversations-list, this endpoint has no first-class
 * `assignedId` field — the only way to filter contacts by assignment is the generic `contactFilter`
 * condition-builder DSL, which this app deliberately doesn't expose (see filter-sheet.tsx's own
 * note on the conversations side). That means `onlyAssignedContacts` (from `usePermissions`)
 * can be enforced on the conversations tab but NOT on this contacts directory — a restricted
 * member can browse the full contact list here even though their conversation view is scoped to
 * their own assignments. Closing this gap would require building the `contactFilter` DSL query,
 * which is out of scope for this pass; flagging it explicitly rather than silently leaving it.
 */
type ListContactsOperation = operations['contactsAPIs.listContactsAuthenticatedAPI'];
export type ListContactsResponse =
  ListContactsOperation['responses'][200]['content']['application/json'];
export type ContactListItem = ListContactsResponse['data'][number];

const PER_PAGE = 30;

export function useContactsInfinite(workspaceId: string | null, keyword: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.ws.contacts.list(workspaceId ?? '', { keyword }),
    enabled: workspaceId !== null,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ListContactsResponse> => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/contacts', {
        params: {
          path: { workspaceId: workspaceId! },
          query: { page: pageParam, perPage: PER_PAGE, keyword: keyword || undefined },
        },
      });
      if (error) throw new ApiError(error);
      return data;
    },
    getNextPageParam: (lastPage, allPages) =>
      allPages.length < lastPage.pageCount ? allPages.length + 1 : undefined,
  });
}

export function flattenContactPages(pages: ListContactsResponse[] | undefined): ContactListItem[] {
  return pages?.flatMap((page) => page.data) ?? [];
}
