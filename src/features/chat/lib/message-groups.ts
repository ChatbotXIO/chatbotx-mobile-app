import type { Message } from '@/features/chat/api/use-messages-infinite';

export type GroupPosition = 'single' | 'first' | 'middle' | 'last';

export interface MessageGroupInfo {
  position: GroupPosition;
  /** Show the sender/avatar meta (name label, extra top spacing) for this item — true on the
   * group's LEADING edge ('first'/'single'). The trailing edge's own meta (timestamp/status) is
   * derived separately by the renderer from `position` itself ('last'/'single') rather than a
   * second boolean here, since unlike the name label it applies to every group shape uniformly. */
  showMeta: boolean;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** A message never groups with a neighbor if either is a non-bubble render (activity/system) —
 * those always stand alone regardless of sender/time proximity. */
function isGroupable(message: Message): boolean {
  return message.messageType !== 'activity' && message.senderType !== 'system';
}

function sameSender(a: Message, b: Message): boolean {
  // senderType alone isn't a unique identity for 'contact' vs 'user' sends from different agents,
  // but the schema doesn't expose a stable per-sender id on every message — senderType is the best
  // available signal and matches what message-bubble.tsx already uses to pick bubble side/variant.
  return a.senderType === b.senderType;
}

function withinWindow(a: Message, b: Message): boolean {
  const diff = Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return diff <= GROUP_WINDOW_MS;
}

/**
 * Computes consecutive-run grouping for a CHRONOLOGICALLY ORDERED (oldest → newest) message
 * array. Messages from the same sender within `GROUP_WINDOW_MS` of the previous message in the
 * run are grouped: the first message in a run is 'first', the last is 'last', everything between
 * is 'middle', and a run of exactly one message is 'single'.
 */
export function computeMessageGroups(messages: Message[]): MessageGroupInfo[] {
  const result: MessageGroupInfo[] = new Array(messages.length);

  let runStart = 0;
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]!;
    const next = messages[i + 1];
    const continuesForward =
      next !== undefined &&
      isGroupable(message) &&
      isGroupable(next) &&
      sameSender(message, next) &&
      withinWindow(message, next);

    if (!continuesForward) {
      // Close out the run [runStart, i].
      const runLength = i - runStart + 1;
      for (let j = runStart; j <= i; j += 1) {
        const position: GroupPosition =
          runLength === 1 ? 'single' : j === runStart ? 'first' : j === i ? 'last' : 'middle';
        result[j] = { position, showMeta: position === 'first' || position === 'single' };
      }
      runStart = i + 1;
    }
  }

  return result;
}
