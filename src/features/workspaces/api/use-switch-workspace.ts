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
 * Single source of truth for the "switch workspace" flow, replacing the three near-identical
 * blocks that used to live in settings/index.tsx, workspace-blocked-gate.tsx, and
 * workspace-picker.tsx. Steps: drop every cached query for the OLD workspace (so a re-entered
 * workspace never shows stale data from a previous session), reset the conversation filters store
 * (filters are workspace-agnostic UI state but shouldn't leak a stale "assigned to me" filter into
 * a workspace where that user id is meaningless), select the new workspace, then navigate.
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
