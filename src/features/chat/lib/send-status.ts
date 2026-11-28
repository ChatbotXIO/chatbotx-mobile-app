import type { NormalizedApiError } from '@/api/errors';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { getOptimisticStatus } from '@/features/chat/components/optimistic-message';

/** Error kind stored on a send the channel rejected for good (the server removed the message). */
export const DELIVERY_FAILED_ERROR_KIND = 'deliveryFailed';

/** Error kind of a send the server refused up front because the messaging window is closed. */
export const MESSAGING_WINDOW_CLOSED_ERROR_KIND =
  'messagingWindowClosed' satisfies NormalizedApiError['kind'];

const WINDOW_CLOSED_SEND_ERROR = /_messaging_window_closed$|_window_expired$/;

/** True for the worker's `sendError` codes (e.g. `whatsapp_messaging_window_closed`,
 * `messenger_human_agent_window_expired`) and for the local early-refusal kind. */
export function isWindowClosedSendError(error: string | null | undefined): boolean {
  return (
    !!error &&
    (error === MESSAGING_WINDOW_CLOSED_ERROR_KIND || WINDOW_CLOSED_SEND_ERROR.test(error))
  );
}

export type SendStatus =
  | { status: 'sending' }
  | { status: 'sent' }
  /** `retryable`: a local row the user can tap to send again. A server row that carries
   * `sendError` is not — re-posting it would leave the failed original in place next to the copy. */
  | { status: 'failed'; retryable: true; errorKind?: string }
  | { status: 'failed'; retryable: false; errorText: string };

/**
 * One outbound message's send state, in priority order:
 * 1. a local optimistic row (request in flight, or rejected / removed) — its own status;
 * 2. a server row with `sendError` — the channel rejected it;
 * 3. a send still waiting for the channel's answer (`isAwaitingDelivery`) — sending;
 * 4. otherwise — sent.
 */
export function resolveSendStatus(message: Message, isAwaitingDelivery: boolean): SendStatus {
  const optimistic = getOptimisticStatus(message);
  if (optimistic?.status === 'pending') return { status: 'sending' };
  if (optimistic?.status === 'failed') {
    // Retrying can't succeed until the contact writes again, so the row is not retryable.
    if (optimistic.errorKind === MESSAGING_WINDOW_CLOSED_ERROR_KIND) {
      return { status: 'failed', retryable: false, errorText: optimistic.errorKind };
    }
    return { status: 'failed', retryable: true, errorKind: optimistic.errorKind };
  }
  if (message.sendError) {
    return { status: 'failed', retryable: false, errorText: message.sendError };
  }
  if (isAwaitingDelivery) return { status: 'sending' };
  return { status: 'sent' };
}
