import { useTranslation } from 'react-i18next';

import { ErrorBanner } from '@/components/ui/error-banner';
import type { NormalizedApiError } from '@/api/errors';

interface QuotaBannerProps {
  error: Extract<NormalizedApiError, { kind: 'workspaceBlocked' }>;
  onDismiss: () => void;
}

const COPY_KEY: Record<'mac' | 'trialExpired' | 'unknown', string> = {
  mac: 'chat.quotaMac',
  trialExpired: 'chat.quotaTrialExpired',
  unknown: 'chat.quotaUnknown',
};

/** Shown when a send fails with a 402 workspaceBlocked error; disables the composer until
 * dismissed (see chat-composer.tsx) — no resolution flow (upgrade CTA) here, that's a later
 * billing-integration concern outside this phase's scope. */
export function QuotaBanner({ error, onDismiss }: QuotaBannerProps) {
  const { t } = useTranslation();

  return (
    <ErrorBanner
      message={t(COPY_KEY[error.reason])}
      tone="warning"
      actionLabel={t('chat.dismiss')}
      onAction={onDismiss}
    />
  );
}
