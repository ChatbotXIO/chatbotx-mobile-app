import { createContext, useContext } from 'react';

interface RealtimeControls {
  /** Rebuilds the connection after a terminal failure (revoked / permanent token error). */
  retry: () => void;
}

export const RealtimeControlsContext = createContext<RealtimeControls>({ retry: () => {} });

export function useRealtimeControls(): RealtimeControls {
  return useContext(RealtimeControlsContext);
}
