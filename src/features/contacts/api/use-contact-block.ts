import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getAuthToken } from '@/api/auth-token';
import { isWorkspaceQuery, queryKeys } from '@/api/query-keys';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import type {
  ConversationListItem,
  ListConversationsResponse,
} from '@/features/conversations/api/use-conversations-infinite';

/**
 * Hand-rolled fetch — no generated-client route exists yet for session/bearer-auth block/unblock
 * (only `contactsAPIs.blockContactWorkspaceTokenAPI`/`unblockContactWorkspaceTokenAPI`, which
 * require workspace-token auth, exist in the schema). Replace with the generated client + delete
 * this hand-rolled fetch once `POST /workspaces/{workspaceId}/contacts/{contactId}/block|unblock`
 * ships under bearer/session auth and `pnpm generate:api` has been re-run.
 */
class FeatureUnavailableError extends Error {}

async function postBlockContact(
  workspaceId: string,
  contactId: string,
  action: 'block' | 'unblock',
): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(
    `${env.apiBaseUrl}/api/workspaces/${workspaceId}/contacts/${contactId}/${action}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
    throw new Error(message);
  }
}

type InfiniteData = { pages: ListConversationsResponse[]; pageParams: unknown[] };

/** Patches `contact.blockedAt` on every cached conversation row for this contact — mirrors
 * `patchAssignedUserByContact` in use-conversation-actions.ts (assign is also keyed by contact
 * id, not conversation id, for the same reason: one contact can back multiple conversations). */
function patchContactBlockedInConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  contactId: string,
  blockedAt: string | null,
) {
  const previous = new Map<readonly unknown[], InfiniteData | undefined>();

  queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        isWorkspaceQuery(query.queryKey, workspaceId) &&
        query.queryKey[2] === 'conversations' &&
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
            data: page.data.map((item: ConversationListItem) =>
              item.contactId === contactId && item.contact
                ? { ...item, contact: { ...item.contact, blockedAt } }
                : item,
            ),
          })),
        };
      });
    });

  return previous;
}

function rollbackConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: Map<readonly unknown[], InfiniteData | undefined>,
) {
  snapshot.forEach((data, key) => {
    queryClient.setQueryData(key, data);
  });
}

/** Takes `contactId` as the mutate-time argument (not bound at hook-call-time) — a list screen
 * rendering many rows needs one shared hook instance per action, invoked with whichever row's id
 * triggered it, rather than a hook bound to a single contact selected via separate state (which
 * would read a stale id if `mutate()` fires in the same tick as the state update that selects a
 * different contact). */
function useToggleContactBlock(workspaceId: string, action: 'block' | 'unblock') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!FEATURES.blockContact) {
        throw new FeatureUnavailableError(
          'Block/unblock is not yet available — the backend session-auth endpoint has not shipped.',
        );
      }
      await postBlockContact(workspaceId, contactId, action);
    },
    onMutate: async (contactId: string) => {
      const detailKey = queryKeys.ws.contacts.detail(workspaceId, contactId);
      const blockedAt = action === 'block' ? new Date().toISOString() : null;
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<ContactDetail>(detailKey);
      if (previousDetail) {
        queryClient.setQueryData<ContactDetail>(detailKey, { ...previousDetail, blockedAt });
      }
      const previousConversations = patchContactBlockedInConversations(
        queryClient,
        workspaceId,
        contactId,
        blockedAt,
      );
      return { detailKey, previousDetail, previousConversations };
    },
    onError: (_err, _contactId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
      if (context?.previousConversations) {
        rollbackConversations(queryClient, context.previousConversations);
      }
    },
    onSettled: (_data, _error, contactId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ws.contacts.detail(workspaceId, contactId),
      });
    },
  });
}

export function useBlockContact(workspaceId: string) {
  return useToggleContactBlock(workspaceId, 'block');
}

export function useUnblockContact(workspaceId: string) {
  return useToggleContactBlock(workspaceId, 'unblock');
}
