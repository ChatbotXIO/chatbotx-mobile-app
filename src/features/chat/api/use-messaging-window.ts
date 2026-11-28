import { deriveMessagingWindow, type MessagingWindow } from '@/features/chat/lib/messaging-window';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';
import { useMinuteClock } from '@/lib/use-minute-clock';

/** Window state for the conversation's primary contact inbox. The server owns the policy; this
 * re-evaluates against the shared minute clock, so thresholds land within a minute (a send in
 * that gap is still refused by the server's `messagingWindowClosed` 409). */
export function useMessagingWindow(
  conversation: ConversationListItem | undefined,
): MessagingWindow {
  const inbox = conversation?.contactInboxes?.[0];
  return deriveMessagingWindow(inbox?.messagingWindow, inbox?.channel, useMinuteClock());
}
