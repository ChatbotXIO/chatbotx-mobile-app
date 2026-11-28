import { useEffect, useState } from 'react';

import {
  deriveMessagingWindow,
  nextMessagingWindowBoundary,
  type MessagingWindow,
} from '@/features/chat/lib/messaging-window';
import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

const COUNTDOWN_TICK_MS = 60_000;
/** Timers fire a hair early on some runtimes; land just past the boundary. */
const BOUNDARY_SLACK_MS = 1;
/** setTimeout overflows (fires immediately) past a signed 32-bit delay. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** Window state for the conversation's primary contact inbox. The server owns the policy; this
 * re-evaluates at the next boundary (changesAt / closing threshold / closesAt) and ticks each
 * minute only while the countdown label is visible. */
export function useMessagingWindow(
  conversation: ConversationListItem | undefined,
): MessagingWindow {
  const [now, setNow] = useState(() => Date.now());

  const inbox = conversation?.contactInboxes?.[0];
  const server = inbox?.messagingWindow;
  const channel = inbox?.channel;
  const model = deriveMessagingWindow(server, channel, now);
  const isCountingDown = model.kind === 'closing';

  const state = server?.state;
  const changesAt = server?.changesAt;
  const closesAt = server?.closesAt;

  useEffect(() => {
    const current = Date.now();
    // Re-sync the clock when the server's verdict changes (refetch after an incoming message).
    const resync = setTimeout(() => setNow(Date.now()), 0);
    if (isCountingDown) {
      const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
      return () => {
        clearTimeout(resync);
        clearInterval(id);
      };
    }
    const boundary = nextMessagingWindowBoundary(
      state ? { state, changesAt: changesAt ?? null, closesAt: closesAt ?? null } : undefined,
      current,
    );
    if (boundary === null) return () => clearTimeout(resync);
    const delay = Math.min(boundary - current + BOUNDARY_SLACK_MS, MAX_TIMEOUT_MS);
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => {
      clearTimeout(resync);
      clearTimeout(id);
    };
  }, [isCountingDown, state, changesAt, closesAt, model.kind]);

  return model;
}
