import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';
import { authorizedFetch } from '@/features/contacts/api/contact-fetch';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  conversationListPredicate,
  patchConversationListCache,
  rollbackConversationListCache,
} from '@/features/conversations/lib/patch-conversation-list-cache';

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
  await authorizedFetch(
    `${env.apiBaseUrl}/api/workspaces/${workspaceId}/contacts/${contactId}/${action}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  );
}

/** Patches `contact.blockedAt` on every cached conversation row for this contact — mirrors
 * `patchAssignedUserByContact` in use-conversation-actions.ts (assign is also keyed by contact
 * id, not conversation id, for the same reason: one contact can back multiple conversations). */
function patchContactBlockedInConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  contactId: string,
  blockedAt: string | null,
) {
  return patchConversationListCache(queryClient, workspaceId, (data) =>
    data.map((item) =>
      item.contactId === contactId && item.contact
        ? { ...item, contact: { ...item.contact, blockedAt } }
        : item,
    ),
  );
}

const rollbackConversations = rollbackConversationListCache;

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
      // Cancel both the detail query and every conversations-list query before patching — without
      // this, a list refetch that resolves mid-mutation can clobber the optimistic patch below
      // with stale server data (same race `cancelConversationQueries` guards against in
      // use-conversation-actions.ts).
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ predicate: conversationListPredicate(workspaceId) }),
      ]);
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
      queryClient.invalidateQueries({ predicate: conversationListPredicate(workspaceId) });
    },
  });
}

export function useBlockContact(workspaceId: string) {
  return useToggleContactBlock(workspaceId, 'block');
}

export function useUnblockContact(workspaceId: string) {
  return useToggleContactBlock(workspaceId, 'unblock');
}
