import { create } from 'zustand';

/**
 * Client-state store mirroring the PartySocket connection's lifecycle (see realtime-provider.tsx,
 * which wires `usePartySocket`'s `onOpen`/`onClose`/`onError` into this). Purely reflects socket
 * state — it does not own reconnect logic (partysocket handles retry itself). Consumed by
 * `ConnectionBanner` call sites (Inbox + chat screen) to render a real connecting/reconnecting/
 * offline indicator instead of the previous hardcoded 'online'.
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface ConnectionStoreState {
  status: ConnectionStatus;
  /** Whether the socket has ever successfully reached `open` at least once during this app
   * session. Distinguishes the FIRST connect (status 'connecting' with `hasEverOpened: false` →
   * banner shows "Connecting…") from a later drop-and-retry (status 'connecting'/'closed' with
   * `hasEverOpened: true` → banner shows "Reconnecting…"/"You're offline"). Reset to `false` on
   * every workspace switch since realtime-provider.tsx remounts (`key={workspaceId}`) and this
   * store is a plain singleton, not scoped per-provider-instance — see `resetConnectionStore`. */
  hasEverOpened: boolean;
  setStatus: (status: ConnectionStatus) => void;
  markOpened: () => void;
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  status: 'connecting',
  hasEverOpened: false,
  setStatus: (status) => set({ status }),
  markOpened: () => set({ status: 'open', hasEverOpened: true }),
}));

/** Resets the store back to its initial "never connected" state — call when the realtime provider
 * itself is torn down for a reason that should NOT be read as "reconnecting" (e.g. workspace
 * switch, where the next connect is a fresh first-connect from the new provider's point of view,
 * not a resume of the old one). */
export function resetConnectionStore(): void {
  useConnectionStore.setState({ status: 'connecting', hasEverOpened: false });
}

/** Maps the store's `status`/`hasEverOpened` pair to `ConnectionBanner`'s four-state prop, so both
 * mount sites (Inbox header, chat screen) render identical banner text/color for the same
 * underlying socket state instead of each hand-rolling the mapping. `open` intentionally still
 * renders as `ConnectionBanner`'s `'online'` state briefly (see that component's own auto-hide
 * behavior) rather than being hidden here — the banner owns "when to disappear". */
export function useConnectionBannerState(): 'online' | 'connecting' | 'reconnecting' | 'offline' {
  return useConnectionStore((state) => {
    if (state.status === 'open') return 'online';
    if (!state.hasEverOpened) return 'connecting';
    return state.status === 'connecting' ? 'reconnecting' : 'offline';
  });
}
