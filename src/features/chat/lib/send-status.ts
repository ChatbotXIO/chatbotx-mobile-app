import type { Message } from '@/features/chat/api/use-messages-infinite';
import { getOptimisticStatus } from '@/features/chat/components/optimistic-message';

/** Error kind stored on a send the channel rejected for good (the server removed the message). */
export const DELIVERY_FAILED_ERROR_KIND = 'deliveryFailed';

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
    return { status: 'failed', retryable: true, errorKind: optimistic.errorKind };
  }
  if (message.sendError) {
    return { status: 'failed', retryable: false, errorText: message.sendError };
  }
  if (isAwaitingDelivery) return { status: 'sending' };
  return { status: 'sent' };
}
