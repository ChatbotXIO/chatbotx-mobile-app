import { create } from 'zustand';

/**
 * Tracks this device's own sends between "the API accepted the request" and "the channel accepted
 * the message". A 201 from `POST /messages` only means the message was queued: the worker then
 * delivers it to the channel (Instagram, Messenger, ...) and answers over realtime with
 * `messageFailed` — `error: null` meaning accepted — or, for a send that failed for good,
 * `messageRemoved` (public-API sends are deleted rather than kept with an error). Until that answer
 * arrives the bubble stays "sending" instead of flashing "sent" and then turning into an error.
 */
export interface TrackedSend {
  conversationId: string;
  /** Server id, known once the create request resolves. Lets `messageRemoved` (which carries ids
   * only) and a `messageFailed` without `clientId` find the send. */
  messageId?: string;
}

interface SendStatusState {
  /** clientId -> a send still waiting for the channel's answer. */
  sends: Record<string, TrackedSend>;
  startTracking: (clientId: string, conversationId: string) => void;
  attachMessageId: (clientId: string, messageId: string) => void;
  stopTracking: (clientId: string) => void;
}

export const useSendStatusStore = create<SendStatusState>((set) => ({
  sends: {},
  startTracking: (clientId, conversationId) =>
    set((state) => ({ sends: { ...state.sends, [clientId]: { conversationId } } })),
  attachMessageId: (clientId, messageId) =>
    set((state) => {
      const existing = state.sends[clientId];
      if (!existing) return state;
      return { sends: { ...state.sends, [clientId]: { ...existing, messageId } } };
    }),
  stopTracking: (clientId) =>
    set((state) => {
      if (!(clientId in state.sends)) return state;
      const { [clientId]: _removed, ...rest } = state.sends;
      return { sends: rest };
    }),
}));

/** Resolves a realtime event's ids to the clientId of a tracked send, or `null` when the event is
 * about a message this device isn't waiting on. */
export function findTrackedClientId(
  sends: Record<string, TrackedSend>,
  ids: { clientId?: string | null; messageId?: string | null },
): string | null {
  if (ids.clientId && ids.clientId in sends) return ids.clientId;
  if (!ids.messageId) return null;
  for (const [clientId, send] of Object.entries(sends)) {
    if (send.messageId === ids.messageId) return clientId;
  }
  return null;
}
