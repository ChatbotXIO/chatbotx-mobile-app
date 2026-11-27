import { normalizeApiError } from '@/api/errors';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { isNetworkError } from '@/lib/describe-api-error';

/** use-send-message.ts stashes pending/failed status on the cached message entry under these
 * `__optimistic*`-prefixed keys (not part of the real `Message` schema type) rather than
 * maintaining a separate parallel list — this narrows that back out safely at render time. */
export interface OptimisticStatus {
  status: 'pending' | 'failed';
  /** Serializable error kind (see `getOptimisticErrorKind`), never raw server text. */
  errorKind?: string;
}

export function getOptimisticStatus(message: Message): OptimisticStatus | null {
  const raw = message as unknown as {
    __optimisticStatus?: 'pending' | 'failed';
    __optimisticError?: string;
  };
  if (!raw.__optimisticStatus) return null;
  return { status: raw.__optimisticStatus, errorKind: raw.__optimisticError };
}

/** Reduces a thrown send error to a serializable kind so the failed bubble can localize it at
 * render time instead of showing the server's English message. */
export function getOptimisticErrorKind(error: unknown): string {
  if (isNetworkError(error)) return 'network';
  return normalizeApiError(error).kind;
}

/** The client-side id of a locally sent message. The server never stores it, so it only exists on
 * rows this device created (or that a realtime echo / create response tagged). */
export function getMessageClientId(message: Message): string | undefined {
  return 'clientId' in message && message.clientId ? message.clientId : undefined;
}

type LocalFields = { __optimisticStatus?: string; __optimisticError?: string };

/** Drops the `__optimistic*` keys off a local row. */
export function stripOptimisticFields(message: Message): Message {
  const {
    __optimisticStatus: _status,
    __optimisticError: _error,
    ...rest
  } = message as Message & LocalFields;
  return rest as Message;
}

/** Marks a row as a failed local send (tap to retry), localized later from `errorKind`. */
export function markOptimisticFailed(message: Message, errorKind: string): Message {
  return {
    ...message,
    __optimisticStatus: 'failed',
    __optimisticError: errorKind,
  } as unknown as Message;
}
