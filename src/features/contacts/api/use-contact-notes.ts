import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

/** Max note length enforced by the API (1-1000 characters). */
export const MAX_NOTE_LENGTH = 1000;

/** Create / edit / delete for a contact's internal notes. Notes are embedded on the contact
 * detail, so every mutation just refetches that one query. */
export function useContactNoteMutations(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();
  const identifier = toContactIdentifier(contactId);

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.ws.contacts.detail(workspaceId, contactId),
    });
  }

  const create = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await apiClient.POST('/v1/contacts/{identifier}/notes', {
        params: { path: { identifier } },
        body: { text },
      });
      if (error) throw new ApiError(error);
    },
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ noteId, text }: { noteId: string; text: string }) => {
      const { error } = await apiClient.PUT('/v1/contacts/{identifier}/notes/{noteId}', {
        params: { path: { identifier, noteId } },
        body: { text },
      });
      if (error) throw new ApiError(error);
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await apiClient.DELETE('/v1/contacts/{identifier}/notes/{noteId}', {
        params: { path: { identifier, noteId } },
      });
      if (error) throw new ApiError(error);
    },
    onSuccess: refresh,
  });

  return { create, update, remove };
}
