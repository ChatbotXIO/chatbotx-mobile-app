# chatbotx-mobile-app

Expo + TypeScript mobile client for [ChatbotX](https://chatbotx.io/) — the open-source omnichannel
chatbot platform.

## ✨ Features

- **Auth & workspaces:** sign in, switch workspaces, workspace picker
- **Live Chat:** Conversations tab with attachments, replies, edit/delete, and read state
- **Contact CRM:** Contacts tab with tags, custom fields, and PII masking for restricted roles
- **Realtime:** PartyKit-backed live updates for messages and conversation state
- **Push notifications:** Expo push + Android FCM, with deep-linking into a conversation/contact
- **i18n:** 20 locales, including RTL support for `ar`/`he`
- **Typed API client:** REST client generated from the backend's OpenAPI spec

## Tech Stack

- [Expo](https://expo.dev) (SDK 57) + [expo-router](https://docs.expo.dev/router/introduction/)
- TypeScript, strict mode
- [TanStack Query](https://tanstack.com/query) for server state
- [Zustand](https://zustand-demo.pmnd.rs/) for client state
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) + [openapi-typescript](https://openapi-ts.dev/) for the typed REST client
- [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) for translations
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for token storage

There is no web target — this app ships iOS/Android only.

## Quick Start

```bash
pnpm install
cp .env.example .env
# edit API_BASE_URL if the backend isn't on the default local port (http://localhost:3123)
pnpm start
```

Then follow the Expo CLI prompts to open the app in a development build, Android emulator, iOS
simulator, or Expo Go. `.env`'s `BRAND=chatbotx` and `APP_ENV=development` defaults are enough to
run the app with zero EAS setup — see [Deploying](#deploying) once you need a real build.

## Development Commands

```bash
pnpm ios              # expo run:ios
pnpm android          # expo run:android
pnpm lint             # expo lint (eslint-config-expo)
pnpm typecheck        # tsc --noEmit
pnpm test             # jest
pnpm format           # prettier --write .
pnpm format:check     # prettier --check .
pnpm generate:api     # regenerate the typed API client from a running backend instance
pnpm brand:new <id>   # scaffold a new brand from brands/_template
```

## Deploying

TEST builds are EAS internal distribution; production builds go through EAS Build/Submit to the
App Store and Play Store. See [docs/deploy.md](docs/deploy.md) for the full flow.

## White-label

This app can be built for a different brand (app name, icons, colors, bundle id, EAS project) from
the same codebase — see [docs/white-label.md](docs/white-label.md).

## Docs

- [Project structure](docs/project-structure.md)
- [Regenerating the API client](docs/api-client.md)
- [Realtime event types](docs/realtime-events.md)
- [Android push notifications](docs/push-notifications.md)
- [EAS Update](docs/eas-updates.md)
- [Deploying (TEST and production)](docs/deploy.md)
- [White-label](docs/white-label.md)
