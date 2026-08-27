import * as Linking from 'expo-linking';

/**
 * Cold-start deep link to a conversation (`chatbotxmobileapp://conversations/:id`, e.g. from a
 * push notification once delivery lands) arrives before the auth bootstrap gate resolves.
 * `(app)/_layout.tsx` redirects an unauthenticated visitor to sign-in, which drops the original
 * target — expo-router has no built-in "return to this deep link after auth" mechanism. This
 * module stashes the conversation path in memory at launch (read once, before any redirect can
 * fire) so sign-in can navigate there instead of the default `/` after a successful login.
 *
 * In-memory only (not persisted): a cold-start deep link is only meaningful for THIS launch: if
 * the process is killed before sign-in completes, the notification (once real push delivery
 * exists) would redeliver or the user re-opens the link.
 */
let pendingConversationPath: string | null = null;
let captured = false;

/** Call once, as early as possible (root layout module scope) — captures the launch URL before
 * any navigation/redirect can consume it. Safe to call multiple times; only the first call has an
 * effect, matching the "cold start only" semantics above. */
export function capturePendingDeepLink(): void {
  if (captured) return;
  captured = true;

  const url = Linking.getLinkingURL();
  if (!url) return;

  const parsed = Linking.parse(url);
  // expo-router path for the chat screen is `conversations/[conversationId]` — Linking.parse
  // gives us the path with the scheme/host stripped, e.g. "conversations/12345".
  const match = /^\/?conversations\/([^/]+)\/?$/.exec(parsed.path ?? '');
  if (match) {
    pendingConversationPath = `/(app)/conversations/${match[1]}`;
  }
}

/** Consume the stashed deep link (if any) — returns it once, then clears it, so a later normal
 * sign-in (e.g. after a manual sign-out) doesn't replay a stale deep link from a previous launch. */
export function consumePendingDeepLink(): string | null {
  const path = pendingConversationPath;
  pendingConversationPath = null;
  return path;
}
