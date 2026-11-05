import { useTranslation } from 'react-i18next';

import { useConnectionPresentation } from './use-connection-presentation';
import type { ConnectionPresentation } from './use-connection-store';

const LABEL_KEYS: Record<ConnectionPresentation, string | null> = {
  online: null,
  // A terminal failure is explained by `ConnectionErrorCard`, not by the title.
  failed: null,
  connecting: 'realtime.connecting',
  'waiting-network': 'realtime.waitingNetwork',
  reconnecting: 'realtime.updating',
};

/** Short status text ("Connecting…", "Waiting for network…", "Updating…") to show in place of a
 * title while the connection is degraded, or `null` when the title should show as usual. */
export function useConnectionStatusLabel(): string | null {
  const { t } = useTranslation();
  const key = LABEL_KEYS[useConnectionPresentation()];
  return key ? t(key) : null;
}
