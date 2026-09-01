import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

/**
 * Bot-active derivation, matching the backend's own rule (`isBotActive =
 * botEnabled || botResumeAt < now`): the bot is considered "active" either because it's
 * explicitly enabled, or because a previous 24h disable-pause (`botResumeAt`) has already
 * elapsed — the backend auto-resumes the bot at that point even though `botEnabled` itself only
 * flips back via the next `enable-bot` call or scheduled job. A `botResumeAt` in the future means
 * the bot is still paused.
 */
export function isBotActive(
  botEnabled: boolean,
  botResumeAt: string | null,
  now: number = Date.now(),
): boolean {
  if (botEnabled) return true;
  if (!botResumeAt) return false;
  return new Date(botResumeAt).getTime() < now;
}

/** Tri-state bot indicator for row/header display: 'paused' (a `botResumeAt` still in the future —
 * `isBotActive` already reports this as inactive, but it's a distinct UI state from a plain
 * 'off') takes priority over the plain `isBotActive` on/off split. */
export function botState(
  botEnabled: boolean,
  botResumeAt: string | null,
  now: number = Date.now(),
): 'on' | 'paused' | 'off' {
  if (botResumeAt && new Date(botResumeAt).getTime() >= now) return 'paused';
  return isBotActive(botEnabled, botResumeAt, now) ? 'on' : 'off';
}

/** Unread = the contact's last incoming activity is newer than the agent's last read timestamp.
 * There's no direct `unreadCount` field on the schema — this derives a boolean from the two
 * timestamps the response does carry (`lastActivityAt`, `agentLastReadAt`). Extracted verbatim
 * from the previous inline `isUnread` in conversation-row.tsx — same semantics, same edge cases
 * (no activity yet → read; activity but never read → unread). */
export function isUnread(
  conversation: Pick<ConversationListItem, 'lastActivityAt' | 'agentLastReadAt'>,
): boolean {
  if (!conversation.lastActivityAt) return false;
  if (!conversation.agentLastReadAt) return true;
  return new Date(conversation.lastActivityAt) > new Date(conversation.agentLastReadAt);
}
