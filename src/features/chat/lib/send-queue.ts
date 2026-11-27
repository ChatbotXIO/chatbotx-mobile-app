import { useSendStatusStore } from '@/features/chat/stores/use-send-status-store';

/** Longest a queued send waits for the previous one's channel answer before going out anyway —
 * the same limit the web inbox uses, so a lost realtime event never stalls the conversation. */
export const SEND_QUEUE_CONFIRM_TIMEOUT_MS = 30_000;

/** Gap between the previous send's channel answer and the next request, as on the web inbox. */
export const SEND_QUEUE_GAP_MS = 500;

/** conversationId -> the promise the next send in that conversation must wait for. */
const tails = new Map<string, Promise<void>>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves once the channel has answered for `clientId` (it left use-send-status-store.ts), or
 * after `timeoutMs`. Resolves at once for a send that isn't tracked (e.g. a flow send). */
export function waitForDeliveryAnswer(clientId: string, timeoutMs: number): Promise<void> {
  if (!(clientId in useSendStatusStore.getState().sends)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = useSendStatusStore.subscribe((state) => {
      if (!(clientId in state.sends)) finish();
    });
  });
}

/**
 * Runs `request` once every earlier send in the same conversation has been answered by the
 * channel, so rapid sends reach Messenger / Instagram / ... in the order they were typed. Without
 * this, parallel requests are delivered by the worker in whatever order they finish.
 *
 * The bubble still appears immediately (optimistic row) and the composer stays unlocked — only the
 * request waits. A failed send releases the queue straight away; the following sends still go out.
 */
export function runInSendQueue<T>(
  conversationId: string,
  clientId: string,
  request: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(conversationId) ?? Promise.resolve();
  const result = previous.then(request);

  const tail = result.then(
    () =>
      waitForDeliveryAnswer(clientId, SEND_QUEUE_CONFIRM_TIMEOUT_MS).then(() =>
        delay(SEND_QUEUE_GAP_MS),
      ),
    () => undefined,
  );
  tails.set(conversationId, tail);
  void tail.then(() => {
    if (tails.get(conversationId) === tail) tails.delete(conversationId);
  });

  return result;
}

/** Test-only: forgets every queued conversation. */
export function resetSendQueue(): void {
  tails.clear();
}
