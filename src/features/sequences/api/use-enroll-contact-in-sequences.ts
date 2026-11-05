import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

/**
 * Enrolls a single contact into one or more sequences via `contacts.subscribeSequences`
 * (`POST /v1/contacts/{identifier}/sequences`, body `{ sequenceIds }`).
 */
export function useEnrollContactInSequences(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequenceIds: string[]) => {
      const { error } = await apiClient.POST('/v1/contacts/{identifier}/sequences', {
        params: { path: { identifier: toContactIdentifier(contactId) } },
        body: { sequenceIds },
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
