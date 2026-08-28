import * as Linking from 'expo-linking';

/**
 * Cold-start deep link to a conversation or contact (`chatbotxmobileapp://conversations/:id` or
 * `.../contacts/:id`, e.g. from a push notification once delivery lands) arrives before the auth
 * bootstrap gate resolves. `(app)/_layout.tsx` redirects an unauthenticated visitor to sign-in,
 * which drops the original target — expo-router has no built-in "return to this deep link after
 * auth" mechanism. This module stashes the resolved route path in memory at launch (read once,
 * before any redirect can fire) so sign-in can navigate there instead of the default `/` after a
 * successful login.
 *
 * In-memory only (not persisted): a cold-start deep link is only meaningful for THIS launch: if
 * the process is killed before sign-in completes, the notification (once real push delivery
 * exists) would redeliver or the user re-opens the link.
 */
let pendingDeepLinkPath: string | null = null;
let captured = false;

/** Deep-link path shapes this app knows how to resolve to a route, in order of priority. Each
 * pattern is matched against the URL's path with the scheme/host stripped (what `Linking.parse`
 * gives us) — accepting both a bare `conversations/:id` / `contacts/:id` link (the natural shape
 * for a push-notification deep link, e.g. `chatbotxmobileapp://conversations/12345`) and one that
 * already embeds the `(app)` route-group prefix (e.g. from a universal link that mirrors the
 * app's own internal route paths verbatim). */
const DEEP_LINK_PATTERNS: { regex: RegExp; buildPath: (id: string) => string }[] = [
  {
    regex: /^\/?(?:\(app\)\/)?conversations\/([^/]+)\/?$/,
    buildPath: (id) => `/(app)/conversations/${id}`,
  },
  {
    regex: /^\/?(?:\(app\)\/)?contacts\/([^/]+)\/?$/,
    buildPath: (id) => `/(app)/contacts/${id}`,
  },
];

/** Call once, as early as possible (root layout module scope) — captures the launch URL before
 * any navigation/redirect can consume it. Safe to call multiple times; only the first call has an
 * effect, matching the "cold start only" semantics above. */
export function capturePendingDeepLink(): void {
  if (captured) return;
  captured = true;

  const url = Linking.getLinkingURL();
  if (!url) return;

  const parsed = Linking.parse(url);
  const path = parsed.path ?? '';

  for (const pattern of DEEP_LINK_PATTERNS) {
    const match = pattern.regex.exec(path);
    if (match) {
      pendingDeepLinkPath = pattern.buildPath(match[1]!);
      return;
    }
  }
}

/** Consume the stashed deep link (if any) — returns it once, then clears it, so a later normal
 * sign-in (e.g. after a manual sign-out) doesn't replay a stale deep link from a previous launch. */
export function consumePendingDeepLink(): string | null {
  const path = pendingDeepLinkPath;
  pendingDeepLinkPath = null;
  return path;
}
