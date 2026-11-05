import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useEffect } from 'react';

import { useConnectionStore } from './use-connection-store';

/** `isInternetReachable` is undefined on some platforms/states; fall back to `isConnected`, and
 * treat a fully unknown reading as reachable so we never claim "offline" without evidence. */
export function isNetworkStateReachable(state: NetworkState): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}

interface UseNetworkReachabilityOptions {
  /** Fires on each transition from unreachable to reachable. */
  onRegained: () => void;
}

/** Mirrors device reachability into the connection store and signals when it comes back, so the
 * socket reconnects immediately instead of waiting out a backoff of up to 30s. */
export function useNetworkReachability({ onRegained }: UseNetworkReachabilityOptions): void {
  const setNetworkReachable = useConnectionStore((state) => state.setNetworkReachable);

  useEffect(() => {
    let isActive = true;
    const apply = (state: NetworkState) => {
      const isReachable = isNetworkStateReachable(state);
      const wasReachable = useConnectionStore.getState().isNetworkReachable;
      setNetworkReachable(isReachable);
      if (isReachable && wasReachable === false) onRegained();
    };

    getNetworkStateAsync()
      .then((state) => {
        if (isActive) apply(state);
      })
      .catch(() => {
        // Reachability is best-effort; the socket's own backoff still recovers.
      });
    const subscription = addNetworkStateListener((state) => apply(state));
    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [onRegained, setNetworkReachable]);
}
