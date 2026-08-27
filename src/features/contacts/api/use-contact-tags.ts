import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';

export type WorkspaceTag = ContactDetail['tags'][number];

/**
 * Available-tags picker source: `tagsAPI.privateListWorkspaceTagsAPI`
 * (`GET /workspaces/{workspaceId}/tags`) — the workspace's full tag catalog, separate from a
 * contact's assigned tags (which come embedded in useContactDetail's `tags` field).
 */
export function useWorkspaceTags(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.tags.catalog(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/tags', {
        params: { path: { workspaceId: workspaceId! } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}

/**
 * `contactsAPIs.addContactTagAuthenticatedAPI` — `POST /workspaces/{workspaceId}/contacts/tags`,
 * body `{ ids: string[], tags: string[] }`: batch by CONTACT id (mirrors Phase 3's assign-by-contact
 * pattern), `tags` is an array of tag ids.
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
      const { error } = await apiClient.POST('/workspaces/{workspaceId}/contacts/tags', {
        params: { path: { workspaceId } },
        body: { ids: [contactId], tags: [tag.id] },
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

/** `contactsAPIs.removeContactTagAuthenticatedAPI` —
 * `DELETE /workspaces/{workspaceId}/contacts/{contactId}/tags/{tagId}`, single contact/tag pair.
 * Optimistic: removes the tag from the cached contact-detail's `tags` array immediately, rolls
 * back on error, reconciles with a settle-time invalidation. */
export function useRemoveContactTag(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.ws.contacts.detail(workspaceId, contactId);

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await apiClient.DELETE(
        '/workspaces/{workspaceId}/contacts/{contactId}/tags/{tagId}',
        { params: { path: { workspaceId, contactId, tagId } } },
      );
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
