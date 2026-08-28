# PR #1 review — `chore(init): scaffold ChatbotX mobile app`

**Decision:** COMMENT (author can't self-approve their own PR). Full fix pass applied on the same
branch, left **unstaged** per review-mode convention — see commit message suggestion at the bottom.

**Scope reviewed:** 259 files, +57k lines. Initial Expo SDK 57 / expo-router scaffold: auth,
workspace picker, 3 tabs (Conversations/Contacts/Settings), chat with attachments, PartyKit
realtime, push notifications, 20-locale i18n (RTL for ar/he), typed REST client from OpenAPI spec.

**Overall assessment:** high-quality scaffold — zero `any`, SecureStore for tokens, FlashList v2
done right, full dark-mode token parity, RTL-aware primitives, 20-locale key parity. Findings
clustered in the optimistic-send lifecycle, store hydration, config/tooling gaps, and template
leftovers — all addressed below.

---

## Findings by severity

### CRITICAL

- **`src/features/chat/api/use-send-message.ts:161,199` (A1)** — `mutationFn` and `onMutate` each
  called `generateClientId()` independently, so the optimistic bubble and the outgoing request body
  carried _different_ clientIds — a duplicate bubble until refetch, an orphaned upload-progress
  entry, and the retry-scroll signal never firing. **Fix:** normalize `clientId` once in a
  `mutate`/`mutateAsync` wrapper before React Query hands params to `onMutate`/`mutationFn`. Added a
  regression test asserting request-body clientId === cached optimistic row's clientId.

- **`src/stores/use-workspace-store.ts` + `src/app/_layout.tsx` (A2)** — no hydration gate on the
  workspace store meant a cold start could read `currentWorkspaceId === null` before the persisted
  value loaded, bouncing an already-workspace-selected signed-in user to the picker. **Fix:** added
  `waitForWorkspaceHydration()` (mirrors `waitForSettingsHydration`), awaited in the auth-bootstrap
  effect before splash hides.

### HIGH

- **`src/app/_layout.tsx` (A3)** — `preventAutoHideAsync()` had no `.catch`; `useFonts` didn't
  destructure `fontError`, so a font-load failure (e.g. offline on first launch) held the splash
  screen forever; `useAuthBootstrap` had no try/catch around `getSession`, so a network failure
  during session validation looked identical to an invalid token (no distinction between "can't
  verify" and "verified invalid"). **Fix:** added `.catch`, `fontsLoaded || fontError` gate, and a
  try/catch that treats a validation _failure_ as signed-out-for-this-launch without clearing
  SecureStore (so the next successful bootstrap can still sign back in with the same token). Also
  added `SplashScreen.setOptions({ fade: true, duration: 300 })` and a root `ErrorBoundary` export
  (expo-router convention) so an uncaught render error doesn't white-screen the app.

- **`src/app/(app)/_layout.tsx:12` (A4)** — `status === 'pending'` (bootstrap not yet resolved) fell
  into the `!== 'signed-in'` branch and redirected to sign-in, which could bounce a
  still-being-verified signed-in user mid-bootstrap. **Fix:** render `null` while pending instead.

- **`src/features/chat/api/use-message-actions.ts` (A5)** — `useDeleteMessage` had no rollback on
  error (a failed delete left the row permanently marked deleted); `useSetMessageAttributes` had no
  cache invalidation at all (like/hide never reflected without a manual refetch); no mutation here
  or in `use-send-message.ts`/`use-conversation-actions.ts` cancelled in-flight queries before
  patching, so a refetch resolving mid-mutation could clobber the optimistic patch. **Fix:** added
  snapshot+rollback to delete, `onSettled` invalidation to attributes and edit, and
  `await queryClient.cancelQueries(...)` at the top of every optimistic `onMutate` across all three
  files (a shared `cancelConversationQueries` helper in `use-conversation-actions.ts` since those
  patches span every cached filter combination). Also fixed a latent bug found while doing this:
  `useArchiveConversations`/`useUnarchiveConversations` built their patch object
  (`{ archivedAt: new Date().toISOString() }`) once at hook-definition time rather than per
  mutation, so every archive used a stale timestamp from whenever the component last rendered —
  moved to a `buildPatch()` factory invoked inside `onMutate`. Added `use-message-actions.test.tsx`
  (didn't exist before) covering delete rollback and attributes invalidation.

- **`src/features/permissions/use-permissions.ts:60-71` (A6)** — `useWorkspaceMembersList` had no
  `enabled` guard, so a `null`/empty workspaceId fired `GET /workspaces//members`, which could
  trigger the global 401→sign-out handler. **Fix:** `enabled: workspaceId.length > 0`. Also deleted
  a byte-for-byte duplicate `useWorkspaceMembers` in `assignment-sheet.tsx` and repointed it at the
  shared hook (same query key, so no extra request in practice — this was pure duplication).

- **`src/lib/query-client.ts:21-31` (A7)** — the global `retry: 1` retried every error including
  4xx (bad input, unauthorized, not found — retrying identically can't change those outcomes), and
  the 401→sign-out handler fired unconditionally, without checking whether the failing request had
  actually carried a token (so a 401 raced against bootstrap, or from a request that never had a
  token, could force-sign-out a user who was never actually rejected). **Fix:** `retry` is now a
  predicate that skips 4xx via `ApiError.body.status`; the 401 handler now checks `getAuthToken()`
  before clearing anything.

- **`src/features/chat/api/send-message-multipart.ts:49,119` (A8)** — the hand-rolled XHR upload
  path threw its own `SendMessageError` class, which `normalizeApiError` didn't recognize at all —
  a 402 quota rejection on an attachment send silently fell through as "unknown error" instead of
  showing the quota banner. **Fix:** replaced `SendMessageError` with `ApiError` built from the
  parsed XHR response body (same `{ code, status, message, data }` shape the typed `apiClient` path
  produces), so `normalizeApiError` classifies it identically regardless of send path.

- **`src/features/contacts/pii-mask.ts` (A9)** — `maskPhone` sized its asterisk run off the raw
  string length (including formatting characters like `-`/`(`/`)`/spaces) instead of the actual
  digit count, so a formatted number like `(555) 123-4567` masked with 4 extra asterisks it didn't
  need; `maskEmail` split on the _first_ `@`, which breaks for a (rare but legal) quoted local-part
  containing `@`, and didn't guard an empty local-part. **Fix:** `maskPhone` sizes off `digits`;
  `maskEmail` splits on `lastIndexOf('@')` and guards `atIndex <= 0`. Updated
  `pii-mask.test.ts` with the corrected expectations plus new empty-local-part and
  quoted-local-part cases.

- **`src/app/(app)/profile.tsx` + `settings/index.tsx` (A10)** — duplicate sign-out logic (fetch
  token, best-effort revoke, clear token, clear query cache, clear workspace, flip auth store); the
  profile-modal copy had **no confirmation and wasn't marked destructive**, so a stray tap
  immediately signed the user out. **Fix:** extracted `useSignOut()` (`src/features/auth/use-sign-out.ts`)
  with the confirm-then-clear-everything flow from settings/index.tsx; both screens now share it.
  Folded in the adjacent Phase D ask while touching profile.tsx: removed the "Plan / —" placeholder
  section (no plan/billing API exists yet to back it) and the empty trailing `SectionHeader`.

### MEDIUM

- **`src/lib/notification-tap.ts:43-50` (A11)** — `getLastNotificationResponseAsync().then(...)`
  had no cancellation guard and no `.catch`; a slow cold-start resolution after the listener's
  cleanup ran could still call `handleResponse` against a torn-down state, and a rejected promise
  was unhandled. **Fix:** `cancelled` flag + `.catch`.

- **`src/realtime/use-realtime-handlers.ts:34-42` (A12)** — the debounced
  conversations-list-invalidate timers are module-scope (`Map<workspaceId, Timeout>`), so nothing
  ever cleared them when the realtime connection tore down — a leaked `setTimeout` per
  not-yet-cached conversation, and the source of the Jest "worker failed to exit gracefully"
  warning noted in the baseline. **Fix:** exported `clearPendingConversationInvalidates()`, called
  alongside `clearAllTypingTimers()` in `realtime-provider.tsx`'s unmount effect. Verified: a full
  suite run right after this fix showed **no** exit warning. (See "Known issues" below — a
  _different_, apparently pre-existing leak resurfaced later, isolated to
  `use-send-message.test.tsx`; not chased further, see notes.)

- **`src/realtime/use-realtime-handlers.ts:88-94` (A13)** — `messageCreated` for the conversation
  the user is actively viewing didn't patch `agentLastReadAt`, so the inbox unread badge could drift
  stale while the user was reading the conversation live over the socket. **Fix:**
  `applyConversationMessageCreated` now takes `activeConversationId` and bumps `agentLastReadAt`
  when the incoming message's conversation matches it. Added tests for both the bump and the
  not-active case.

- **`src/realtime/apply-conversation-events.ts:141-144` (A14)** — hoisted the matched conversation
  row to the front of _whichever page it was found on_, not just page 0 — for a row on a later
  page, this duplicated it across the client's merged view and corrupted cursor pagination. **Fix:**
  only hoist when `pageIndex === 0`; a later-page match is patched in place. Added a multi-page
  regression test.

- **`src/realtime/realtime-provider.tsx:83-91` (A15)** — `resetConnectionStore()` ran in a
  post-mount `useEffect`, but `usePartySocket` starts connecting immediately on render — a fast
  `onOpen` could fire and flip the store to `'open'` _before_ the effect's reset ran, clobbering it
  back to `'connecting'` and leaving the connection banner stuck. **Fix:** reset moved to run
  exactly once per mounted instance via `useState`'s lazy initializer (not a ref read/write during
  render — the project's `reactCompiler: true` setting disallows that pattern; confirmed by ESLint
  during this review, see "Caught during review" below).

- **`src/realtime/parse-event.ts:65` (A16)** — `messageFailed`'s validator rejected `error ===
undefined` (only `null` or a string passed), so an event that _omitted_ the field entirely (valid
  per the type, which already allowed optional) failed validation and the whole event was dropped
  silently. **Fix:** `isOptionalNullableString`; also widened `RealtimeEventMessageFailed.error` to
  `string | null | undefined` in `events.ts` to match.

- **`app.config.ts:34` (A17)** — `googleServicesFile` was referenced unconditionally, but the file
  is gitignored (per-dev/CI secret) — every clean checkout's Android build/prebuild would fail
  before the secret is provisioned. **Fix:** conditional on `existsSync`; documented the EAS
  file-secret setup in README.

- **`app.config.ts` + `src/i18n/reconcile-rtl.ts` (A18)** — expo-updates was installed but not
  wired up (no `runtimeVersion`/`updates`/plugin entry); the RTL bootstrap called `forceRTL`
  _before_ checking `__DEV__`, doing an unnecessary native call it then discarded; and the silent
  bootstrap reload path could pop a blocking `Alert` if `!Updates.isEnabled`, from a code path with
  nothing rendered yet to explain the alert's context to the user. **Fix:** added
  `runtimeVersion: { policy: 'appVersion' }`, `updates.url`, and the `'expo-updates'` plugin;
  reordered the `__DEV__` check before `forceRTL`; `reloadApp` now takes a `{ silent }` option, used
  by the bootstrap path to fall back to silence instead of alerting.

- **`eas.json` (A19)** — no per-profile `env`, so a preview/production build had no
  `API_BASE_URL`/`WS_URL` baked in — worst case, shipping a build that silently points at
  `localhost`. **Fix:** added `env` blocks per profile (dev points at local ports; preview/
  production carry placeholder URLs the team should replace with real values before first use).

### Dead code / template leftovers (no user-facing behavior change)

- Deleted `scripts/reset-project.js`, its `reset-project` script, and the `example` line in
  `.gitignore` (destructive create-expo-app leftover with zero purpose in a real app).
- Deleted `src/hooks/` (`use-color-scheme.ts` + `.web.ts`) — zero importers anywhere.
- Deleted `useThemedStyles` (`use-theme.ts`) — zero callers; deleted `motionEasings`/`motionSprings`
  from `tokens.ts` and the corresponding `durations`/`easings`/`springs`/`pressScale` re-exports from
  `theme/motion.ts` (kept only `useReducedMotion`, the only thing anything actually imports from
  that module) — confirmed zero consumers of `theme.motion.easings`/`.springs` anywhere in the tree.
- Removed the empty `if (context.skippedOptimistic) {}` block in `use-send-message.ts` (folded into
  the existing comment); `MAX_FILE_SIZE_BYTES` is now `export const` at its definition instead of a
  bottom re-export statement.
- Deleted `ActionContext` (`use-conversation-actions.ts`) — declared, exported, never imported
  anywhere.
- Removed the no-op `['device-token']` query invalidation in `use-device-token.ts` — nothing ever
  caches under that key; also added a cancellation flag to the push-token-rotation listener
  (previously no guard against firing register/unregister calls after unmount).
- Made `MAX_MULTI_SELECT` module-private in `pick-attachments.ts` (only used within its own file).
- Removed the identity `.map` and no-`await` `async` in `composer.tsx`'s `handleCamera`/
  `handleDocument`.
- **Deps removed** (and `pnpm install` re-run to refresh the lockfile): `react-dom`,
  `react-native-web`, `test-renderer` (wrong package name — not `react-test-renderer`; nothing
  imported it), `cross-env` (nothing referenced it). Removed the `web` config block +
  `favicon.png` reference from `app.config.ts`, and the `pnpm web` script.
- **Dev gallery**: moved `(dev)/gallery.tsx`'s ~380-line body (24 UI-primitive imports) to
  `src/dev/gallery-content.tsx`, `require()`d lazily inside the route's `__DEV__` branch — those
  imports no longer ship in production bundles, while the route itself still resolves so typed
  routes stay valid in every build.
- **Deprecated color aliases**: codemodded all ~28 remaining call sites off
  `colors.{background,surface,surfaceElevated,border,text,primary,primaryForeground}` onto the
  semantic keys (`bg`/`surface2`/`surface1`/`borderSubtle`/`textPrimary`/`brand`/`onBrand`), deleted
  the alias block from `tokens.ts` and its doc comment, updated `tokens.test.ts` to assert the
  aliases are now `undefined` instead of asserting they exist.
- Consolidated `flattenMessagePages`/`flattenConversationPages` (each a one-line wrapper around
  `flattenPages`) — deleted both, call sites now use `flattenPages` directly.
- Removed stale plan-artifact comments ("Phase N", references to a plan/report) opportunistically
  in every file this review otherwise touched; a repo-wide sweep of files _not_ otherwise touched
  was out of scope for this pass — grep `Phase [0-9]\|see report\|see plan` in `src/` for the
  remainder if a follow-up wants to finish that sweep.
- `isWorkspaceListQuery`-style consolidation (query-keys.ts helper unifying the
  `queryKey[2]==='conversations' && queryKey[3]==='list'` predicate scattered across
  `use-conversation-actions.ts`/`use-realtime-handlers.ts`/`find-conversation-in-cache.ts`) was
  **not done** in this pass — the individual predicates were left as-is since consolidating them
  touches several files for a pure readability win with no behavior change; flagged as a good
  follow-up, not blocking.
- Removed `queryKeys.ws.contacts.tags`/`.sequences` — zero callers anywhere.

### UI/UX polish

- Touch targets: `error-banner.tsx`'s retry action now has `hitSlop={8}` +
  `accessibilityLabel`; `segmented-tabs.tsx` segments now have `minHeight: 44`, and its indicator's
  `left: 0` → `start: 0` (was breaking in RTL).
- Contrast: light-mode `textTertiary` `#948d7c` (~3.0:1 against `bg`) → `#767063` (~4.51:1, meets
  WCAG AA) — dark mode was already compliant (~4.57:1), left unchanged.
- Haptics: `ListItem`'s default flipped from `'light'` on every navigation tap to `false` —
  navigating to a screen doesn't need a haptic beyond the transition itself; destructive rows keep
  `'medium'`. Chips/toggles/segmented-tabs already correctly used `'selection'`, unchanged.
  `camera.tsx` now fires a `'light'` haptic on capture, `'success'`/`'error'` on
  settle, and dims the shutter button with an `ActivityIndicator` while capturing (previously no
  visual feedback at all beyond `disabled`).
- `+not-found.tsx`: the "go home" button now uses `EmptyState`'s own `action` prop instead of
  floating below it as a separate `Button`.
- `sign-in.tsx`: replaced the `Card`-as-divider hack with a proper rule-with-label row (`Divider` +
  centered caption); the logo block now fades in (`FadeInUp`, reduced-motion aware).
- `index.tsx`'s `LoadingScreen`: bare `ActivityIndicator` → branded pulsing logo mark (matches the
  sign-in screen's icon treatment), reduced-motion aware.
- Loading fidelity: `contacts/index.tsx` → `SkeletonRow.Contact` (was a flat generic block);
  `settings/members.tsx` → `SkeletonRow.Conversation` shape (closer match to its avatar+title+badge
  rows); `[conversationId]/contact.tsx`'s outer gate skeleton now matches `ContactPanel`'s own
  loading shape exactly, instead of a bare single circle.
- **Not done in this pass:** empty-state descriptions/actions for `conversations.empty` /
  `contacts.empty` / `workspaces.empty` (needs new i18n keys across 20 locales + an
  `scripts/i18n-sync.ts` run — scoped out given the size of this pass already); the Settings screen
  profile-row-as-branded-header-card / theme-picker-as-mini-previews / `tabBarBadge`-matching-
  `CountPill` redesign asks (larger visual redesign work, not a bug fix); `settings.tsx` push-toggle
  distinct-copy-for-denied-vs-failure; `image-viewer.tsx` accessibility label + pinch-zoom.

### Performance / correctness (Phase C)

- `[conversationId]/index.tsx:52-53` — `[...messages].reverse()` was recomputed inline every
  render, invalidating `message-list.tsx`'s own `messagesById`/`rows` `useMemo`s on every parent
  re-render. **Fix:** `flattenPages` result and the reversed array are both memoized now.
- `justSentMessageId` in the same file was derived from `sendMessage.isSuccess` — which stays
  `true` for the mutation's entire lifetime until the next `mutate()` call, so it pointed at a
  stale clientId indefinitely between sends. **More severe than the plan's phrasing suggested**:
  this `useSendMessage(...)` instance is used _only_ for the retry path in this screen — the
  composer instantiates its **own separate** `useSendMessage(...)` for normal sends, so
  `sendMessage.data` here never reflected a composer send at all; the force-scroll-to-own-message
  behavior was effectively broken for every non-retry send. **Fix:** added
  `justSentClientIdByConversation` to the shared `useChatStore`, set once in `useSendMessage`'s
  `onSuccess` (skipped for flow sends), read by the chat screen regardless of which hook instance
  performed the send.
- `handleRetry` only re-sent `text`, silently dropping any attachments or reply context — retrying
  a failed attachment/reply send produced a plain text message. **Fix:** rebuilds
  `attachments`/`replyTo` from the failed optimistic row (parent `createdAt` recovered from the
  already-loaded messages list, since the row itself only carries `parentId`).
- Hoisted per-render color-map/variant-map object literals behind `useMemo` in `text.tsx`,
  `button.tsx`, `connection-banner.tsx`, `error-banner.tsx` — each rebuilt a lookup object every
  render just to read one entry out of it; `text.tsx`/`button.tsx` in particular render on every
  message/list row.
- `toast.tsx:68-94` — the exit-animation's inner `setTimeout(dismissCurrent, ...)` was never
  tracked or cleared, only the outer one; if `current` changed mid-exit-animation the inner timer
  still fired later against a stale render. **Fix:** both timers tracked, both cleared in cleanup;
  also filled in the effect's real dependencies (`reducedMotion`, `motion.durations.*`,
  `translateY`, `opacity`) instead of a blanket exhaustive-deps disable — `reducedMotion` in
  particular is genuinely not static (OS accessibility toggle).
- `swipeable-row.tsx:119-142` — `trackProgress` mutated a shared value (`progressShared.value`) as
  a side effect of a render-phase function (`renderLeftActions`/`renderRightActions`, invoked by
  RNGH during render to build the action panels) — exactly the pattern React/reanimated warn
  against, even though it "worked." **Fix:** removed `progressShared`/`useAnimatedReaction`
  entirely; the reveal haptic now fires from RNGH's own `onSwipeableWillOpen` callback.
- `skeleton.tsx:29-36` now respects `useReducedMotion()` (static opacity instead of a repeating
  pulse).
- `screen.tsx` — dropped the redundant inner `flex: 1` `View` (the outer `SafeAreaView` already
  provides it; pure passthrough wrapper).
- `dayjs-locales.ts` — was 20 static side-effect imports at module load; now each locale is loaded
  lazily inside `setDayjsLocale`. Metro needs a **static, literal** `require()` argument to bundle a
  module (a template-literal path can't be resolved at bundle time, unlike webpack's context
  modules) — used a per-locale literal-`require()` lookup table rather than one dynamically-built
  call.
- `use-conversation-actions.ts:255,266` — `new Date().toISOString()` was called once at
  hook-definition time (inside `useArchiveConversations`/`useUnarchiveConversations`'s call to the
  shared `useBatchConversationAction`), not per-mutate — every archive optimistically patched with a
  timestamp from whenever the component last rendered, not the actual archive time. **Fix:** the
  patch is now built by a `buildPatch()` factory invoked inside `onMutate`.
- `use-device-token.ts:78-87` — added a cancellation flag to the push-token-rotation listener (see
  "Dead code" section above for the paired no-op-invalidation removal in the same file).
- Replaced all 7 `router.push/replace(... as never)` sites with the typed object form
  (`{ pathname, params }`) where the target is a route this app's typed-routes manifest knows
  statically; the 2 sites where the target is a genuinely arbitrary runtime string (captured deep
  links in `sign-in.tsx`/`social-buttons.tsx`) use expo-router's own `Href` type instead of `never`
  — a more accurate cast for "any valid path string," not a workaround.
- Added `export function ErrorBoundary` in `src/app/_layout.tsx` (see A3).
- `pending-deep-link.ts` now accepts both a bare `conversations/:id`/`contacts/:id` deep link and
  one that already embeds the `(app)` route-group prefix — previously only the bare form matched.
  Added `pending-deep-link.test.ts` (didn't exist before) covering both shapes plus the
  unrecognized-path and consume-once cases.

### Tooling / CI (Phase E)

- `.github/workflows/ci.yml`: added `pnpm format:check` and `npx expo-doctor` steps; bumped
  `node-version` to 22.
- `package.json`: added `"packageManager": "pnpm@11.15.1"` so `pnpm/action-setup@v4` in CI resolves
  a pinned version automatically instead of drifting to whatever's latest.
- Fixed the `import/first` warnings in `src/api/client.test.ts` (the two `jest.mock()` calls were
  above the imports they mock — Jest hoists `jest.mock` regardless of source position, so this was
  purely a lint-order fix, not a behavior change).
- Ran `pnpm format` across the repo (also reformatted two `.claude/commands/*.md` files that were
  already out of Prettier's style — incidental, not hand-edited).
- **Not done** (blocked by this repo's own config-protection hook, which exists specifically to
  stop agents from silently weakening lint/format rules): `no-console` rule in `eslint.config.js`,
  `endOfLine: 'lf'` in `.prettierrc.json`. Both are legitimate, plan-requested additive changes, not
  a weakening — but the hook can't distinguish that, and bypassing a guard rail the user
  deliberately installed isn't this review's call to make. **Action needed from a human:** apply
  these two one-line config changes directly, or explicitly disable the hook for this edit.
- `app.config.ts`: `newArchEnabled`/`edgeToEdgeEnabled` from the original plan **don't exist** as
  config properties in Expo SDK 57 — both New Architecture and edge-to-edge are mandatory/default
  with no opt-out knob in this SDK version (confirmed against the versioned SDK 57 docs). Left
  explanatory comments in place of the properties rather than setting nonexistent config keys.
- **Not done:** `scripts/i18n-sync.ts` marking backfilled English placeholders — real work (a
  `*.todo.json` sidecar or CI count check) that's independent of everything else in this pass;
  scoped out.

---

## Verification

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                | ✅ clean                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm lint`                     | ✅ 0 errors (8 pre-existing warnings in `jest.setup.ts`/`scripts/i18n-sync.ts`/`.expo/types`, none in touched files) — **1 real error caught and fixed during this review**: `realtime-provider.tsx`'s ref-read-during-render (see A15) violated `reactCompiler: true`'s stricter ref-access rule; fixed via `useState`'s lazy initializer instead of a ref |
| `pnpm format:check`             | ✅ clean                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test`                     | ✅ 41 suites / 293 tests passing (up from 39/279 at baseline — new tests for A1's clientId-parity, A5's delete-rollback/attributes-invalidate, A9's pii-mask cases, A14's page-0-only hoist, pending-deep-link's path matching)                                                                                                                             |
| `npx expo-doctor`               | 2 pre-existing, unrelated failures: 14 packages with patch-version drift from the exact SDK-pinned versions, and a duplicate `expo-file-system` resolution — neither touched by this pass, not silently bumped (native-build-affecting, out of scope for a review-fix pass)                                                                                 |
| `npx expo config --type public` | shows `updates`/`runtimeVersion`, no `web` block                                                                                                                                                                                                                                                                                                            |
| `git status`                    | only unstaged modifications, no staged changes, no unexpected untracked files beyond the 4 new files this pass added                                                                                                                                                                                                                                        |

**Known issue not resolved:** the Jest "worker failed to exit gracefully" warning is back after a
clean run right after A12's fix showed it gone. Isolated it to `use-send-message.test.tsx`
specifically (running that file alone, including its _pre-existing, untouched_ tests, reproduces it
with `--forceExit` needed) — this points at something inherent to that test file's setup (likely a
native-module mock or `jest-expo` environment characteristic) rather than a regression from this
pass's changes, but I could not get a definitive stack trace: `--detectOpenHandles` took several
minutes to return in this sandbox (worker-pool disabled, real Node handle timeouts), well past what
was practical to wait out repeatedly. All 293 tests pass correctly regardless — this only affects
the test _process's_ exit, not test correctness. Flagging for a follow-up with a faster local
environment to run `--detectOpenHandles` to completion.

---

## Suggested commit message

```
fix(scaffold): address PR #1 review — optimistic-send ids, hydration gate, config, dead code
```
