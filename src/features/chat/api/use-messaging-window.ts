import { useEffect, useState } from 'react';

import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { getMessagingWindow, type MessagingWindow } from '@/features/chat/lib/messaging-window';

const TICK_MS = 60_000;

/** Window state for the conversation's primary contact inbox, re-evaluated every minute so the
 * header countdown and the locked composer flip without a refetch. */
export function useMessagingWindow(
  conversation: ConversationListItem | undefined,
): MessagingWindow {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const inbox = conversation?.contactInboxes?.[0];
  return getMessagingWindow(inbox?.channel, inbox?.lastIncomingMessageAt, now);
}
