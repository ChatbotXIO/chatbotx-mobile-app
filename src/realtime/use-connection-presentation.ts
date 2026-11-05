import { useEffect, useState } from 'react';

import {
  deriveConnectionPresentation,
  useConnectionStore,
  type ConnectionPresentation,
} from './use-connection-store';

/** Sub-second drops (backgrounding, brief handoffs) never reach the UI: a degraded state only
 * surfaces after it has persisted this long. Recovery and terminal failure show immediately. */
export const CONNECTION_GRACE_MS = 1500;

/** The presentation the UI should render. While healthy (or still inside the grace window) it
 * returns `'online'`, which callers render as "no status" — there is deliberately no "back
 * online" flash, including on cold start. */
export function useConnectionPresentation(): ConnectionPresentation {
  const raw = useConnectionStore(deriveConnectionPresentation);
  const isDegraded = raw !== 'online' && raw !== 'failed';
  const [hasSurfaced, setHasSurfaced] = useState(false);

  useEffect(() => {
    if (!isDegraded) return undefined;
    const timer = setTimeout(() => setHasSurfaced(true), CONNECTION_GRACE_MS);
    return () => {
      clearTimeout(timer);
      setHasSurfaced(false);
    };
  }, [isDegraded]);

  if (!isDegraded) return raw;
  return hasSurfaced ? raw : 'online';
}
