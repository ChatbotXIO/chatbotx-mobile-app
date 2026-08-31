import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getAuthToken } from '@/api/auth-token';
import { isWorkspaceQuery } from '@/api/query-keys';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';
import type { ListContactsResponse } from '@/features/contacts/api/use-contacts-infinite';

/**
 * Hand-rolled fetch — no generated-client route exists for this endpoint at all
 * (`GET /workspaces/{workspaceId}/contacts/{contactId}` has no sibling `delete` in the schema).
 * Replace with the generated client + delete this file once
 * `DELETE /workspaces/{workspaceId}/contacts/{contactId}` ships and `pnpm generate:api` has been
 * re-run.
 */
class FeatureUnavailableError extends Error {}

async function deleteContactRequest(workspaceId: string, contactId: string): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(
    `${env.apiBaseUrl}/api/workspaces/${workspaceId}/contacts/${contactId}`,
    {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = (await response.json()) as { message?: string };
      message = errorBody.message ?? message;
    } catch {
      // Non-JSON error body — fall back to statusText.
    }
    throw new Error(message);
  }
}

type InfiniteData = { pages: ListContactsResponse[]; pageParams: unknown[] };

/** Removes the contact from every cached contacts-list page (any keyword filter) — same
 * find-all-matching-queries approach as the conversations list patches in
 * use-conversation-actions.ts. Also invalidates the conversations list, since a deleted contact's
 * conversations should no longer appear there either. */
export function useDeleteContact(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!FEATURES.deleteContact) {
        throw new FeatureUnavailableError(
          'Delete contact is not yet available — the backend endpoint has not shipped.',
        );
      }
      await deleteContactRequest(workspaceId, contactId);
    },
    onMutate: async (contactId: string) => {
      await queryClient.cancelQueries({
        predicate: (query) =>
          isWorkspaceQuery(query.queryKey, workspaceId) && query.queryKey[2] === 'contacts',
      });

      const previous = new Map<readonly unknown[], InfiniteData | undefined>();
      queryClient
        .getQueryCache()
        .findAll({
          predicate: (query) =>
            isWorkspaceQuery(query.queryKey, workspaceId) &&
            query.queryKey[2] === 'contacts' &&
            query.queryKey[3] === 'list',
        })
        .forEach((query) => {
          previous.set(query.queryKey, query.state.data as InfiniteData | undefined);
          queryClient.setQueryData<InfiniteData>(query.queryKey, (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.filter((item) => item.id !== contactId),
              })),
            };
          });
        });

      return { previous };
    },
    onError: (_err, _contactId, context) => {
      context?.previous.forEach((data, key) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          isWorkspaceQuery(query.queryKey, workspaceId) && query.queryKey[2] === 'conversations',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          isWorkspaceQuery(query.queryKey, workspaceId) && query.queryKey[2] === 'contacts',
      });
    },
  });
}
