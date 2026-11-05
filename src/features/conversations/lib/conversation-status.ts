import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

/** How long a `disable-bot` call keeps the bot off before the backend auto-resumes it. Used to
 * approximate the server-computed `botResumeAt` in the optimistic patch. */
export const BOT_PAUSE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Bot on/off derivation, matching the backend's own rule (`isBotActive =
 * botEnabled || botResumeAt < now`): the bot is active either because it's explicitly enabled,
 * or because the auto-resume time (`botResumeAt`) set by a previous disable has already elapsed.
 * A `botResumeAt` still in the future means the bot is off. This is the single source of truth
 * for every bot indicator in the UI.
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

export type BotState = 'on' | 'paused' | 'off';

/**
 * Three-state view of the bot for the UI: `on` (answering), `paused` (switched off by an agent but
 * scheduled to auto-resume), `off` (human-only). Built on `isBotActive`, so every indicator —
 * inline glyph, swipe action, chat header — agrees with the backend's rule.
 */
export function botState(
  botEnabled: boolean,
  botResumeAt: string | null,
  now: number = Date.now(),
): BotState {
  if (isBotActive(botEnabled, botResumeAt, now)) return 'on';
  return botResumeAt ? 'paused' : 'off';
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
