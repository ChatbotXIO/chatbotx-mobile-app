import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isWorkspaceQuery } from '@/api/query-keys';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';
import { authorizedFetch } from '@/features/contacts/api/contact-fetch';
import type { ListContactsResponse } from '@/features/contacts/api/use-contacts-infinite';
import {
  conversationListPredicate,
  patchConversationListCache,
} from '@/features/conversations/lib/patch-conversation-list-cache';

/**
 * Hand-rolled fetch — no generated-client route exists for this endpoint at all
 * (`GET /workspaces/{workspaceId}/contacts/{contactId}` has no sibling `delete` in the schema).
 * Replace with the generated client + delete this file once
 * `DELETE /workspaces/{workspaceId}/contacts/{contactId}` ships and `pnpm generate:api` has been
 * re-run.
 */
class FeatureUnavailableError extends Error {}

async function deleteContactRequest(workspaceId: string, contactId: string): Promise<void> {
  await authorizedFetch(`${env.apiBaseUrl}/api/workspaces/${workspaceId}/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

type InfiniteData = { pages: ListContactsResponse[]; pageParams: unknown[] };

/** Removes the contact from every cached contacts-list page (any keyword filter) — same
 * find-all-matching-queries approach as the conversations list patches in
 * use-conversation-actions.ts. Also removes the deleted contact's rows from the conversations
 * list cache directly (targeted patch, not a whole-space invalidate — refetching every
 * conversations-list query on every delete is unnecessary churn when we already know exactly
 * which rows must go). */
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
    onSuccess: async (_data, contactId) => {
      // Cancel first so an in-flight conversations-list refetch can't clobber this patch with
      // stale server data still containing the now-deleted contact's rows.
      await queryClient.cancelQueries({ predicate: conversationListPredicate(workspaceId) });
      patchConversationListCache(queryClient, workspaceId, (data) =>
        data.filter((item) => item.contactId !== contactId),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          isWorkspaceQuery(query.queryKey, workspaceId) && query.queryKey[2] === 'contacts',
      });
    },
  });
}
