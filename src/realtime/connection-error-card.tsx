import { useTranslation } from 'react-i18next';

import { ErrorBanner } from '@/components/ui/error-banner';

import { useRealtimeControls } from './realtime-context';
import { useConnectionStore, type ConnectionFailureReason } from './use-connection-store';

const REASON_KEYS: Record<ConnectionFailureReason, string> = {
  revoked: 'realtime.failedRevoked',
  auth: 'realtime.failedAuth',
  unknown: 'realtime.failedGeneric',
};

/** Persistent inline explanation for a terminal realtime failure (revoked membership or a
 * permanent token-mint error), with a Retry that rebuilds the connection. Renders nothing while
 * the connection is healthy or merely reconnecting. */
export function ConnectionErrorCard() {
  const { t } = useTranslation();
  const { retry } = useRealtimeControls();
  const failureReason = useConnectionStore((state) =>
    state.status === 'failed' ? (state.failureReason ?? 'unknown') : null,
  );

  if (!failureReason) return null;

  return (
    <ErrorBanner
      tone="warning"
      message={`${t('realtime.failedTitle')}\n${t(REASON_KEYS[failureReason])}`}
      actionLabel={t('realtime.retry')}
      onAction={retry}
    />
  );
}
