import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

/**
 * Removes a contact from a single sequence via `contacts.unsubscribeSequences`
 * (`DELETE /v1/contacts/{identifier}/sequences`, body `{ sequenceIds }`).
 */
export function useUnenrollContactFromSequences(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequenceId: string) => {
      const { error } = await apiClient.DELETE('/v1/contacts/{identifier}/sequences', {
        params: { path: { identifier: toContactIdentifier(contactId) } },
        body: { sequenceIds: [sequenceId] },
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
