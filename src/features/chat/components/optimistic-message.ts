import type { Message } from '@/features/chat/api/use-messages-infinite';

/** use-send-message.ts stashes pending/failed status on the cached message entry under these
 * `__optimistic*`-prefixed keys (not part of the real `Message` schema type) rather than
 * maintaining a separate parallel list — this narrows that back out safely at render time. */
export interface OptimisticStatus {
  status: 'pending' | 'failed';
  errorMessage?: string;
}

export function getOptimisticStatus(message: Message): OptimisticStatus | null {
  const raw = message as unknown as {
    __optimisticStatus?: 'pending' | 'failed';
    __optimisticError?: string;
  };
  if (!raw.__optimisticStatus) return null;
  return { status: raw.__optimisticStatus, errorMessage: raw.__optimisticError };
}
