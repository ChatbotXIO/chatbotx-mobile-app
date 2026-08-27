/**
 * Expiry timers for realtime `typing` events. The `typing` payload carries a `seconds` TTL (see
 * events.ts's `RealtimeEventTyping`) that was previously ignored entirely — once
 * `setTyping(conversationId, true)` fired, nothing ever cleared it if the sender's own
 * `typing: false` follow-up was dropped/delayed, so "Typing…" could stick forever. This module is
 * a tiny scheduler keyed by conversationId, backed by a module-level timer map (not React state —
 * it's driven from use-realtime-handlers.ts, outside any component's render).
 */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Schedules `onExpire` to run after `seconds` (falling back to a default TTL for 0/undefined —
 * see use-realtime-handlers.ts's call site), clearing any existing timer for the same
 * conversationId first so a fresh `typing: true` event resets the countdown rather than stacking
 * timers. */
export function scheduleTypingExpiry(
  conversationId: string,
  seconds: number,
  onExpire: () => void,
): void {
  clearTypingTimer(conversationId);
  const timer = setTimeout(() => {
    timers.delete(conversationId);
    onExpire();
  }, seconds * 1000);
  timers.set(conversationId, timer);
}

/** Clears the pending expiry timer for one conversation, if any — called when an explicit
 * `typing: false` event arrives (the sender stopped before the TTL elapsed) so it doesn't fire a
 * redundant `setTyping(id, false)` later. */
export function clearTypingTimer(conversationId: string): void {
  const existing = timers.get(conversationId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(conversationId);
  }
}

/** Clears every pending expiry timer — called on socket teardown (workspace switch/unmount) so no
 * stale timer from a torn-down connection fires after a new one has taken over the same
 * conversationId keys. */
export function clearAllTypingTimers(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
}
