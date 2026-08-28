import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import type { Message } from '@/features/chat/api/use-messages-infinite';

interface RichContentViewProps {
  contentType: Message['contentType'];
  outbound: boolean;
}

/** Fallback for `contentType: "refLink"` (and any future content type the app doesn't render a
 * dedicated view for) — the schema doesn't expose a structured shape for refLink beyond
 * `contentAttributes` (same loose JSON-value union as location), so this renders a plain
 * "unsupported content" notice rather than guessing a structured card layout. */
export function RichContentView({ contentType }: RichContentViewProps) {
  const { t } = useTranslation();
  return (
    <Text variant="caption" color="secondary">
      {t('chat.unsupportedContent', { contentType })}
    </Text>
  );
}
