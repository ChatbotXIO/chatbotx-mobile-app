import { useTranslation } from 'react-i18next';

import { formatConversationTime } from '@/lib/format-conversation-time';
import { useMinuteClock } from '@/lib/use-minute-clock';

/** Compact timestamp that stays fresh without a timer per row: every row re-renders off the one
 * shared minute clock. Returns `''` when there is no timestamp. */
export function useConversationTimeLabel(date: string | null | undefined): string {
  const { t, i18n } = useTranslation();
  const nowMs = useMinuteClock();
  if (!date) return '';
  // `i18n.language` is a dependency of the label (dayjs locale follows it); reading it here keeps
  // the lint rule honest and makes the intent explicit.
  void i18n.language;
  return formatConversationTime(date, new Date(nowMs), {
    yesterday: t('conversations.yesterday'),
  });
}
