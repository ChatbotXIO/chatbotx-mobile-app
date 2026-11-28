import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { applyWorkspaceSwitch } from '@/features/workspaces/api/switch-workspace';

interface SwitchWorkspaceOptions {
  /** When true, navigates to the conversations tab after switching (used by an inline switch from
   * the workspace switcher sheet). When `next` is null, this is ignored — the workspace picker is
   * always the destination for "no workspace selected". */
  navigate?: boolean;
}

/**
 * Single source of truth for the "switch workspace" flow: applies the state change via
 * `applyWorkspaceSwitch` (cache cleanup, filter reset, workspace selection — see that helper), then
 * navigates.
 *
 * `next: null` clears the selection entirely and always routes to the workspace picker (sign-out
 * style / "switch workspace" from a blocked gate). A non-null `next` optionally navigates to the
 * inbox when `opts.navigate` is set — the workspace switcher sheet uses this for an inline switch
 * that doesn't require leaving the current tab stack; callers that already own their own navigation
 * (e.g. the picker screen selecting a workspace for the first time) can omit it.
 */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    (next: string | null, opts?: SwitchWorkspaceOptions) => {
      applyWorkspaceSwitch(queryClient, next);

      if (next === null) {
        router.replace('/(app)/workspace-picker');
        return;
      }

      if (opts?.navigate) {
        router.replace('/(app)/(tabs)/conversations');
      }
    },
    [queryClient, router],
  );
}
