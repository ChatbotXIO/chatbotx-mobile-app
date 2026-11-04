import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';
import {
  conversationListPredicate,
  patchConversationListCache,
  rollbackConversationListCache,
} from '@/features/conversations/lib/patch-conversation-list-cache';

async function postBlockContact(contactId: string, action: 'block' | 'unblock'): Promise<void> {
  const params = { path: { identifier: toContactIdentifier(contactId) } };
  const { error } =
    action === 'block'
      ? await apiClient.POST('/v1/contacts/{identifier}/block', { params })
      : await apiClient.POST('/v1/contacts/{identifier}/unblock', { params });
  if (error) throw new ApiError(error);
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
      await postBlockContact(contactId, action);
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
