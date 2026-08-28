# Project structure

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
  realtime/       realtime event types mirrored from the backend (type-only, manual sync)
  stores/         app-wide Zustand client-state stores (auth, workspace, settings)
  theme/          design tokens, the useTheme() hook, and motion/reduced-motion helpers
scripts/
  generate-api-client.ts   regenerates src/api/generated/schema.ts from the backend's OpenAPI spec
  i18n-sync.ts             backfills missing translation keys across all 20 locales from en.json
```
