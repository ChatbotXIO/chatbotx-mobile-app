import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { isWorkspaceQuery } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';
import type { ListContactsResponse } from '@/features/contacts/api/use-contacts-infinite';
import {
  conversationListPredicate,
  patchConversationListCache,
} from '@/features/conversations/lib/patch-conversation-list-cache';

async function deleteContactRequest(contactId: string): Promise<void> {
  const { error } = await apiClient.DELETE('/v1/contacts/{identifier}', {
    params: { path: { identifier: toContactIdentifier(contactId) } },
  });
  if (error) throw new ApiError(error);
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
      await deleteContactRequest(contactId);
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
