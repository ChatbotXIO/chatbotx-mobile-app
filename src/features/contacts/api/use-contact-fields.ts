import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';

/**
 * `customFieldsAPI.privateListCustomFieldsAPI` — `GET /workspaces/{workspaceId}/custom-fields`:
 * the workspace's full custom-field catalog (id/name/type), separate from a contact's currently
 * *set* field values (which come embedded on `useContactDetail`).
 */
export function useWorkspaceCustomFields(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.customFields.catalog(workspaceId ?? ''),
    enabled: workspaceId !== null,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/custom-fields', {
        params: { path: { workspaceId: workspaceId! } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}

/**
 * `contactsAPIs.addContactFieldAuthenticatedAPI` —
 * `POST /workspaces/{workspaceId}/contacts/{contactId}/fields`, body `{ customFieldId, value }`.
 * Also used to *update* an already-set field's value — same endpoint upserts. Invalidates the
 * contact-detail cache rather than optimistically patching it, since the response body is
 * untyped in the generated schema.
 */
export function useSetContactField(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { customFieldId: string; value: string }) => {
      const { error } = await apiClient.POST(
        '/workspaces/{workspaceId}/contacts/{contactId}/fields',
        {
          params: { path: { workspaceId, contactId } },
          body: input,
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

/** `contactsAPIs.deleteContactFieldAuthenticatedAPI` —
 * `DELETE /workspaces/{workspaceId}/contacts/{contactId}/fields/{customFieldId}`. */
export function useDeleteContactField(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customFieldId: string) => {
      const { error } = await apiClient.DELETE(
        '/workspaces/{workspaceId}/contacts/{contactId}/fields/{customFieldId}',
        { params: { path: { workspaceId, contactId, customFieldId } } },
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
