import { create } from 'zustand';

/**
 * Client-state store mirroring the v2 realtime connection lifecycle. It reflects socket and
 * network state but does not own reconnect logic; `createRealtimeConnection` handles retry and
 * cursor recovery. UI reads it through `deriveConnectionPresentation` (see
 * `use-connection-presentation.ts`, which adds the grace period).
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'failed';
export type ConnectionFailureReason = 'revoked' | 'auth' | 'unknown';

/** What the user should be told, independent of timing. */
export type ConnectionPresentation =
  'online' | 'connecting' | 'waiting-network' | 'reconnecting' | 'failed';

interface ConnectionStoreState {
  status: ConnectionStatus;
  /** `null` until the first reachability reading arrives. */
  isNetworkReachable: boolean | null;
  /** Whether the socket has reached `open` at least once since the provider mounted. Separates the
   * FIRST connect ("Connecting…") from a later drop-and-retry ("Updating…"). Reset on every
   * workspace switch (`resetConnectionStore`) since the provider remounts per workspace. */
  hasEverOpened: boolean;
  failureReason: ConnectionFailureReason | null;
  setStatus: (status: Exclude<ConnectionStatus, 'failed'>) => void;
  markOpened: () => void;
  markFailed: (reason: ConnectionFailureReason) => void;
  setNetworkReachable: (isReachable: boolean) => void;
}

const INITIAL_STATE = {
  status: 'connecting',
  hasEverOpened: false,
  failureReason: null,
} as const;

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  ...INITIAL_STATE,
  isNetworkReachable: null,
  // A terminal failure only clears through an explicit non-failed status (i.e. retry started).
  setStatus: (status) => set({ status, failureReason: null }),
  markOpened: () => set({ status: 'open', hasEverOpened: true, failureReason: null }),
  markFailed: (failureReason) => set({ status: 'failed', failureReason }),
  setNetworkReachable: (isNetworkReachable) => set({ isNetworkReachable }),
}));

/** Resets the connection fields back to "never connected" — call when the provider is torn down
 * for a reason that must NOT read as "reconnecting" (workspace switch). Reachability belongs to
 * the device, not the workspace, so it is kept. */
export function resetConnectionStore(): void {
  useConnectionStore.setState({ ...INITIAL_STATE });
}

type PresentationInput = Pick<
  ConnectionStoreState,
  'status' | 'isNetworkReachable' | 'hasEverOpened'
>;

export function deriveConnectionPresentation(state: PresentationInput): ConnectionPresentation {
  if (state.status === 'failed') return 'failed';
  if (state.status === 'open') return 'online';
  if (state.isNetworkReachable === false) return 'waiting-network';
  return state.hasEverOpened ? 'reconnecting' : 'connecting';
}
