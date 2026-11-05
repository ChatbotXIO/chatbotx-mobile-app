import { useSyncExternalStore } from 'react';

const MINUTE_MS = 60_000;

const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;
let currentMinute = Math.floor(Date.now() / MINUTE_MS);

function tick(): void {
  const next = Math.floor(Date.now() / MINUTE_MS);
  if (next === currentMinute) return;
  currentMinute = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!interval) {
    // Catch up immediately: the app may have slept since the last subscriber went away.
    tick();
    interval = setInterval(tick, 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

/** Epoch ms rounded down to the minute, shared by every subscriber through ONE interval instead
 * of a timer per list row. Re-renders subscribers only when the minute actually changes. */
export function useMinuteClock(): number {
  const minute = useSyncExternalStore(
    subscribe,
    () => currentMinute,
    () => currentMinute,
  );
  return minute * MINUTE_MS;
}
