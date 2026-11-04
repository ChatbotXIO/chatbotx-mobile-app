import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { fetchAllPages, MAX_PER_PAGE } from '@/api/pagination';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

/**
 * `customFields.list` (`GET /v1/custom-fields`), drained across pages: the workspace's full
 * custom-field catalog (id/name/type), separate from a contact's currently *set* field values
 * (which come merged into `useContactDetail`).
 */
export function useWorkspaceCustomFields(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.customFields.catalog(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: () =>
      fetchAllPages(async (page) => {
        const { data, error } = await apiClient.GET('/v1/custom-fields', {
          params: { query: { page, perPage: MAX_PER_PAGE } },
        });
        if (error) throw new ApiError(error);
        return data;
      }),
  });
}

/**
 * `contacts.setCustomField` — `PUT /v1/contacts/{identifier}/custom-fields/{idOrName}`, body
 * `{ value }`. The same endpoint sets and updates a value. Invalidates the contact-detail cache
 * rather than optimistically patching it.
 */
export function useSetContactField(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { customFieldId: string; value: string }) => {
      const { error } = await apiClient.PUT('/v1/contacts/{identifier}/custom-fields/{idOrName}', {
        params: {
          path: { identifier: toContactIdentifier(contactId), idOrName: input.customFieldId },
        },
        body: { value: input.value },
      });
      if (error) throw new ApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ws.contacts.detail(workspaceId, contactId),
      });
    },
  });
}

/** `contacts.clearCustomField` — `DELETE /v1/contacts/{identifier}/custom-fields/{idOrName}`. */
export function useDeleteContactField(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customFieldId: string) => {
      const { error } = await apiClient.DELETE(
        '/v1/contacts/{identifier}/custom-fields/{idOrName}',
        {
          params: {
            path: { identifier: toContactIdentifier(contactId), idOrName: customFieldId },
          },
        },
      );
      if (error) throw new ApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ws.contacts.detail(workspaceId, contactId),
      });
    },
  });
}
