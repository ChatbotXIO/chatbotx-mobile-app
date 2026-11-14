import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSignOutLocally } from '@/features/auth/use-sign-out';

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE';
export const ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE = 'accountDeletionSupportRequired';

async function deleteAccountRequest(): Promise<void> {
  const { error } = await apiClient.DELETE('/v1/me', {
    body: { confirmation: ACCOUNT_DELETION_CONFIRMATION },
  });
  if (error) throw new ApiError(error);
}

/**
 * Schedules deletion of the signed-in account. The server revokes every session, refresh token and
 * push token on success, so the local teardown skips token revocation (it would 401 anyway).
 */
export function useDeleteAccount() {
  const signOutLocally = useSignOutLocally();

  return useMutation({
    mutationFn: deleteAccountRequest,
    onSuccess: () => signOutLocally({ revokeToken: false }),
  });
}
