# chatbotx-mobile-app

Expo + TypeScript mobile client for [ChatbotX](https://github.com/) — the open-source omnichannel
chatbot platform whose backend lives in the sibling repo, `../aha.chat`. This app replaces the
legacy `chatbotx-mobile` React Native project (untyped JS, old Laravel backend).

Auth, workspace picker, and three tabs — Conversations, Contacts, and Settings — are implemented,
along with chat with attachments, PartyKit realtime, push notifications, 20-locale i18n (including
RTL for `ar`/`he`), and a typed REST client generated from the backend's OpenAPI spec.

> This app talks to the `aha.chat` backend's `bearer()` better-auth plugin and the REST endpoints
> under `/api/workspaces/{workspaceId}/...`, plus the corresponding realtime events. Run
> `pnpm --filter builder dev` in `aha.chat` first so `pnpm generate:api` (see below) has a live
> spec to fetch.

## Stack

- [Expo](https://expo.dev) (SDK 57) + [expo-router](https://docs.expo.dev/router/introduction/) (file-based routing, `src/app/`)
- TypeScript, strict mode
- [TanStack Query](https://tanstack.com/query) for server state
- [Zustand](https://zustand-demo.pmnd.rs/) for client state
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) + [openapi-typescript](https://openapi-ts.dev/) for a typed REST client generated from the backend's OpenAPI spec
- [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) for translations
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for token storage
- ESLint (`eslint-config-expo`, flat config) + Prettier

## Get started

```bash
pnpm install
pnpm start
```

Then follow the Expo CLI prompts to open the app in a development build, Android emulator, iOS
simulator, or Expo Go.

Other useful commands:

```bash
pnpm ios              # expo run:ios
pnpm android           # expo run:android
pnpm lint                # expo lint (eslint-config-expo)
pnpm typecheck             # tsc --noEmit
pnpm format                 # prettier --write .
pnpm format:check            # prettier --check .
```

There is no web target — this app ships iOS/Android only (see `app.config.ts`; `react-dom` /
`react-native-web` are not dependencies).

## Configuration

The API base URL is env-driven via `app.config.ts` (not a static `app.json`, since we need
`process.env` at config-evaluation time) and exposed to the app at runtime through
`expo-constants` (see `src/config/env.ts`).

```bash
cp .env.example .env
# edit API_BASE_URL if the builder app isn't on the default local port
```

Defaults to `http://localhost:3123` — the aha.chat builder app's standard local dev URL.

### Android push notifications (`google-services.json`)

Android FCM V1 push delivery requires a Firebase project with this app's package name
(`com.chatconnectx.mobile`) registered, and its `google-services.json` downloaded to the repo
root — the file is gitignored (per-developer/CI secret, never committed). `app.config.ts` only
references it conditionally (`existsSync` check), so a clean checkout without the file still
builds; Android push registration simply won't work until it's provisioned. For EAS builds,
upload it as a [file-type secret](https://docs.expo.dev/eas/environment-variables/#file-environment-variables)
via `eas env:create` (or the EAS dashboard) referencing the path `./google-services.json`, rather
than committing it.

### EAS Update

This app ships with `expo-updates` configured (`app.config.ts`'s `updates`/`runtimeVersion`), so
production/preview builds can receive OTA JS-bundle updates via `eas update` without an app-store
resubmission. `runtimeVersion` uses the `appVersion` policy — a build only receives updates
published against the same `version` in `app.config.ts`.

## Regenerating the API client

```bash
pnpm generate:api
```

This fetches `{API_BASE_URL}/api/spec.json` (the full oRPC router spec, including the
bearer/session-authenticated routes the app needs — override with `API_SPEC_PATH` to point at the
workspace-token-only `/api/public-spec.json` instead) from a running aha.chat builder instance and
runs it through `openapi-typescript` to produce `src/api/generated/schema.ts`, which
`src/api/client.ts` consumes via `openapi-fetch`.

The script is **not** wired into the build — the backend isn't guaranteed to be running, and this
repo must build without it. If the spec endpoint isn't reachable, the script prints a clear
message and exits non-zero without touching the previously generated file. Run it from the
`aha.chat` repo first: `pnpm --filter builder dev`.

## Realtime event types

`src/realtime/events.ts` mirrors the realtime event type definitions from
`aha.chat/packages/partysocket-config/src/schemas.ts` **by hand**. This app lives in a separate
git repository (not a pnpm workspace member of `aha.chat`), so there's no live cross-repo import —
copying types in is the intentionally simple, non-fragile choice over a symlink or git submodule.
Only type-only shapes are mirrored; the server-side `lib.ts` in that package is never referenced.

When the source file changes in `aha.chat`, re-copy the updated shapes by hand. The header comment
in `src/realtime/events.ts` notes which commit it was last synced against.

## Project structure

```
src/
  api/            typed REST client (openapi-fetch), auth token storage, big-number-safe JSON parsing
    generated/    output of `pnpm generate:api` — do not hand-edit
  app/            expo-router screens (file-based routing)
  components/ui/  design-system primitives (Button, Text, ListItem, Sheet, Skeleton, etc.)
  config/         runtime env config (API_BASE_URL via expo-constants)
  dev/            dev-build-only screens' content (e.g. the UI gallery), lazily required so their
                  imports don't ship in production bundles
  features/       feature modules (chat, contacts, conversations, workspaces, settings, ...) —
                  each owns its own api/ (TanStack Query hooks), components/, and stores/
  i18n/           i18next setup, RTL reconciliation, and locale files (20 locales)
  lib/            shared library wiring (TanStack Query client, push notifications, deep links)
  realtime/       realtime event types mirrored from aha.chat (type-only, manual sync)
  stores/         app-wide Zustand client-state stores (auth, workspace, settings)
  theme/          design tokens, the useTheme() hook, and motion/reduced-motion helpers
scripts/
  generate-api-client.ts   regenerates src/api/generated/schema.ts from the backend's OpenAPI spec
  i18n-sync.ts             backfills missing translation keys across all 20 locales from en.json
```

## Related repo

Backend: [`aha.chat`](../aha.chat) — Next.js builder app, oRPC API, Drizzle/Postgres, BullMQ
workers, PartyKit realtime. See its `AGENTS.md` for architecture details.
