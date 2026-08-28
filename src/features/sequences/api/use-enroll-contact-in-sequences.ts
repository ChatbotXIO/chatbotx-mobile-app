import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getAuthToken } from '@/api/auth-token';
import { queryKeys } from '@/api/query-keys';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';

/**
 * Hand-rolled fetch — no generated-client route exists yet for this endpoint (backend needs to
 * add `POST /workspaces/{workspaceId}/contacts/sequences`, bearer-auth, mirroring the existing
 * `POST /contacts/tags` convention). Replace with the generated client + delete this file once
 * shipped and `pnpm generate:api` has been re-run.
 *
 * Request shape mirrors the web app's Next.js server action body exactly: `{ ids, sequences }`,
 * where `ids` are contact ids and `sequences` are sequence ids — matching the
 * `POST /workspaces/{workspaceId}/contacts/tags` convention's `{ ids, tags }` shape.
 */
interface EnrollContactsInSequencesRequest {
  ids: string[];
  sequences: string[];
}

class EnrollSequencesError extends Error {}

async function postEnrollContactsInSequences(
  workspaceId: string,
  body: EnrollContactsInSequencesRequest,
): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(
    `${env.apiBaseUrl}/api/workspaces/${workspaceId}/contacts/sequences`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = (await response.json()) as { message?: string };
      message = errorBody.message ?? message;
    } catch {
      // Non-JSON error body — fall back to statusText.
    }
    throw new EnrollSequencesError(message);
  }
}

/**
 * Enrolls a single contact into one or more sequences. Safely importable/callable even while
 * `FEATURES.sendSequence` is off — `mutationFn` throws immediately, before any network call, so
 * nothing reaches the (nonexistent) backend route by accident.
 */
export function useEnrollContactInSequences(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequenceIds: string[]) => {
      if (!FEATURES.sendSequence) {
        throw new EnrollSequencesError(
          'Send sequence is not yet available — the backend enroll endpoint has not shipped.',
        );
      }
      await postEnrollContactsInSequences(workspaceId, {
        ids: [contactId],
        sequences: sequenceIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ws.contacts.detail(workspaceId, contactId),
      });
    },
  });
}
