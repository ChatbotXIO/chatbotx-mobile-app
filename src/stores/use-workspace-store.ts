import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Client-state store for the currently selected workspace. This is deliberately client-only
 * state (not server state) — the actual list of workspaces the user belongs to comes from
 * TanStack Query (`features/workspaces/api/use-workspaces.ts`).
 *
 * `currentWorkspaceId` mirrors the bigint-as-string id convention used throughout the ChatbotX
 * API (see AGENTS.md invariant #10 in the aha.chat repo). Persisted so the app reopens on the
 * last-selected workspace instead of forcing the picker every launch.
 */
interface WorkspaceStoreState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (workspaceId: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (workspaceId) => set({ currentWorkspaceId: workspaceId }),
    }),
    {
      name: 'workspace-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Resolves once the persisted workspace-store snapshot has been read from AsyncStorage (or
 * immediately, if hydration already finished before this was called). Without gating on this,
 * cold start reads `currentWorkspaceId === null` before hydration completes and bounces an
 * already-signed-in, already-workspace-selected user to the workspace picker. */
export function waitForWorkspaceHydration(): Promise<void> {
  if (useWorkspaceStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsubscribe = useWorkspaceStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
