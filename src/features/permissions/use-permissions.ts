import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { useAuthStore } from '@/stores/use-auth-store';

/**
 * `GET /workspaces/{workspaceId}/members` (`workspaceMembersAPI.listWorkspaceMembersAuthenticatedAPI`
 * in src/api/generated/schema.ts) embeds a `permissions` object on every member row with EXACTLY
 * these field names — no mapping needed against the plan's shorthand:
 * `{ superAdmin, analytics, flows, contacts, onlyAssignedContacts, emailAndPhone, broadcast, ecommerce }`.
 * This hook finds the current signed-in user's own member row (matched by `userId` against the
 * auth store) and exposes its permission bits. Shares the same members-list query the Phase 3
 * assignment-sheet already fetches (`queryKeys.ws.members.list`), so no extra request in practice.
 */
export interface WorkspacePermissions {
  isSuperAdmin: boolean;
  onlyAssignedContacts: boolean;
  canSeeEmailAndPhone: boolean;
  canSeeAnalytics: boolean;
  canSeeFlows: boolean;
  canSeeContacts: boolean;
  canSeeBroadcast: boolean;
  canSeeEcommerce: boolean;
  /** True while the underlying members-list query hasn't resolved yet (or the current user's own
   * member row hasn't been found in it). Callers that gate a query's `enabled` on permissions
   * being settled (e.g. `useConversationsInfinite`'s `onlyAssignedContacts` enforcement) should
   * wait on this rather than firing against the fail-closed defaults below. */
  isLoading: boolean;
}

/** Super admins bypass every restriction, mirroring the backend's own authorization checks. */
const DEFAULT_PERMISSIONS: Omit<WorkspacePermissions, 'isLoading'> = {
  isSuperAdmin: false,
  onlyAssignedContacts: false,
  canSeeEmailAndPhone: true,
  canSeeAnalytics: true,
  canSeeFlows: true,
  canSeeContacts: true,
  canSeeBroadcast: true,
  canSeeEcommerce: true,
};

/**
 * PII-masking-relevant defaults used ONLY while the member row is loading or can't be found.
 * Unlike `DEFAULT_PERMISSIONS` (which stays open so the app doesn't lock up other UI on a fetch
 * hiccup), `canSeeEmailAndPhone` fails CLOSED here — masking is the one bit where "briefly show
 * unmasked PII on every mount" is an actual data-exposure bug (see contact-row.tsx / info-tab.tsx
 * consumers), not just a UX inconvenience. `onlyAssignedContacts` also fails closed (scoped to
 * "assigned to me") for the same reason: a restricted member's conversation list must never
 * briefly show everyone else's conversations while permissions are still loading.
 */
const LOADING_PERMISSIONS: Omit<WorkspacePermissions, 'isLoading'> = {
  ...DEFAULT_PERMISSIONS,
  onlyAssignedContacts: true,
  canSeeEmailAndPhone: false,
};

export function useWorkspaceMembersList(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.ws.members.list(workspaceId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/workspaces/{workspaceId}/members', {
        params: { path: { workspaceId } },
      });
      if (error) throw new ApiError(error);
      return data.data;
    },
  });
}

/** Returns the signed-in user's own permission bits for `workspaceId`. While the member row is
 * loading or can't be found, PII-masking-relevant bits (`canSeeEmailAndPhone`,
 * `onlyAssignedContacts`) fail CLOSED (see LOADING_PERMISSIONS) so a fetch hiccup can't briefly
 * expose unmasked contact data or another agent's conversations; other bits stay open by default
 * so unrelated UI (flows/analytics/etc. visibility) doesn't lock up on every mount. The backend
 * still enforces real authorization server-side regardless of this UI gate. */
export function usePermissions(workspaceId: string | null): WorkspacePermissions {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: members, isLoading: isMembersLoading } = useWorkspaceMembersList(workspaceId ?? '');

  if (!workspaceId || !currentUserId || isMembersLoading || !members) {
    return { ...LOADING_PERMISSIONS, isLoading: true };
  }

  const ownMember = members.find((member) => member.userId === currentUserId);
  if (!ownMember) {
    return { ...LOADING_PERMISSIONS, isLoading: false };
  }

  const { permissions } = ownMember;
  if (permissions.superAdmin) {
    return { ...DEFAULT_PERMISSIONS, isSuperAdmin: true, isLoading: false };
  }

  return {
    isSuperAdmin: false,
    onlyAssignedContacts: permissions.onlyAssignedContacts,
    canSeeEmailAndPhone: permissions.emailAndPhone,
    canSeeAnalytics: permissions.analytics,
    canSeeFlows: permissions.flows,
    canSeeContacts: permissions.contacts,
    canSeeBroadcast: permissions.broadcast,
    canSeeEcommerce: permissions.ecommerce,
    isLoading: false,
  };
}
