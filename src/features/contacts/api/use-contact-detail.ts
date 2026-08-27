import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import type { operations } from '@/api/generated/schema';

/**
 * `contactsAPIs.getContactAuthenticatedAPI` (`GET /workspaces/{workspaceId}/contacts/{contactId}`)
 * embeds `tags`, `customFields`, `contactNotes`, AND `contactsOnSequences` (each with its full
 * nested `sequence` object) in ONE response — verified against the generated schema. No separate
 * tags/custom-fields/sequences fetch is needed for the detail view; the panel's Info/Tags/Sequences
 * tabs all read off this single query. Sequences data is clean (not "awkward" per the plan's
 * fallback note), so the sequences tab is kept rather than dropped.
 */
type GetContactOperation = operations['contactsAPIs.getContactAuthenticatedAPI'];
export type ContactDetail = GetContactOperation['responses'][200]['content']['application/json'];

export function useContactDetail(workspaceId: string | null, contactId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.contacts.detail(workspaceId ?? '', contactId ?? ''),
    enabled: workspaceId !== null && contactId !== null,
    queryFn: async (): Promise<ContactDetail> => {
      const { data, error } = await apiClient.GET(
        '/workspaces/{workspaceId}/contacts/{contactId}',
        { params: { path: { workspaceId: workspaceId!, contactId: contactId! } } },
      );
      if (error) throw new ApiError(error);
      return data;
    },
  });
}
