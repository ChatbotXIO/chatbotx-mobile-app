import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import type { ContactDetail, ContactTag } from '@/features/contacts/api/use-contact-detail';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

export type WorkspaceTag = ContactTag;

/**
 * Available-tags picker source: `tags.list` (`GET /v1/tags`), drained across pages — the
 * workspace's full tag catalog, separate from a contact's assigned tags (which come embedded in
 * useContactDetail's `tags` field).
 */
export function useWorkspaceTags(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.tags.catalog(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: () =>
      fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/tags', {
          params: { query: { page, perPage: MAX_PER_PAGE } },
        });
        if (error) throw new ApiError(error);
        return data;
      }),
  });
}

/**
 * `contacts.addTags` — `POST /v1/contacts/{identifier}/tags`, body `{ tagIds: string[] }`.
 *
 * Optimistic: takes the full tag object (not just an id) so `onMutate` can push it straight into
 * the cached contact-detail's `tags` array and the UI shows the new chip immediately, instead of
 * waiting on a refetch. Rolls back via the pre-mutation snapshot on error; `onSettled` always
 * invalidates to reconcile with server truth (the response body is untyped in the generated
 * schema, so there's nothing authoritative to merge in on success).
 */
export function useAddContactTag(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.ws.contacts.detail(workspaceId, contactId);

  return useMutation({
    mutationFn: async (tag: WorkspaceTag) => {
      const { error } = await apiClient.POST('/v1/contacts/{identifier}/tags', {
        params: { path: { identifier: toContactIdentifier(contactId) } },
        body: { tagIds: [tag.id] },
      });
      if (error) throw new ApiError(error);
    },
    onMutate: async (tag: WorkspaceTag) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<ContactDetail>(detailKey);
      if (previous && !previous.tags.some((existing) => existing.id === tag.id)) {
        queryClient.setQueryData<ContactDetail>(detailKey, {
          ...previous,
          tags: [...previous.tags, tag],
        });
      }
      return { previous };
    },
    onError: (_err, _tag, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

/** `contacts.removeTags` —
 * `DELETE /v1/contacts/{identifier}/tags`, body `{ tagIds: string[] }`.
 * Optimistic: removes the tag from the cached contact-detail's `tags` array immediately, rolls
 * back on error, reconciles with a settle-time invalidation. */
export function useRemoveContactTag(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.ws.contacts.detail(workspaceId, contactId);

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await apiClient.DELETE('/v1/contacts/{identifier}/tags', {
        params: { path: { identifier: toContactIdentifier(contactId) } },
        body: { tagIds: [tagId] },
      });
      if (error) throw new ApiError(error);
    },
    onMutate: async (tagId: string) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<ContactDetail>(detailKey);
      if (previous) {
        queryClient.setQueryData<ContactDetail>(detailKey, {
          ...previous,
          tags: previous.tags.filter((tag) => tag.id !== tagId),
        });
      }
      return { previous };
    },
    onError: (_err, _tagId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}
