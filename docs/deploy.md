# Deploying (TEST and production)

This app builds and ships through [EAS](https://expo.dev/eas) (Expo Application Services) — EAS
Build for native binaries, EAS Update for OTA JS updates, EAS Submit for store submission. GitHub
Actions (`.github/workflows/ci.yml`) only runs lint/typecheck/test/`expo-doctor`; the actual
build/update/submit pipeline lives in [EAS Workflows](https://docs.expo.dev/eas/workflows/)
(`.eas/workflows/*.yml`), which run on Expo's own infrastructure, not GitHub's.

See [white-label.md](white-label.md) if you're building this app for a different brand than the
default `chatbotx` one tracked in this repo.

## Concepts

- **`BRAND`** selects `brands/<BRAND>/brand.json` — app id, name, colors, icons, and EAS project.
  Defaults to `chatbotx`. See [white-label.md](white-label.md).
- **`APP_ENV`** (`development` | `preview` | `production`) suffixes the bundle id/app name and
  picks the EAS Update channel, so dev/test/prod builds can be installed side-by-side on one
  device. See the table in the root `app.config.ts`.
- **TEST = EAS internal distribution.** There is no separate "staging" app-store listing — the
  `preview` build profile produces an internal-distribution build (installed via a link EAS
  generates, not through TestFlight/Play internal testing) so QA can install it without a store
  review cycle.

## Prerequisites

1. An [Expo account](https://expo.dev/signup) with access to the project's EAS organization.
2. `eas login` (or `EXPO_TOKEN` in CI — already wired into `.eas/workflows/*.yml` implicitly via
   EAS's own auth, no GitHub secret needed for jobs that run natively on EAS).
3. An Apple Developer Program membership and a Google Play Console account, for anything that
   submits to a store (`pnpm submit:prod` / the `release` EAS Workflow).

### First-time EAS project setup (a fresh clone/fork)

A brand's `eas.projectId` starts empty until you run `eas init` for it:

```bash
BRAND=chatbotx eas init
```

This creates (or links) an EAS project and writes the resulting `projectId` into
`brands/chatbotx/brand.json` — **not** into `app.json`, since there is no `app.json` in this repo
(see `app.config.ts`). Until `eas.projectId` is set, `expo start`/Expo Go work fine with zero EAS
setup; `updates` and `extra.eas` are simply omitted from the resolved config.

### EAS Environment Variables (per brand, per environment)

`API_BASE_URL`, `WS_URL`, and the Android `google-services.json` file are **not** committed —
they're set as [EAS Environment Variables](https://docs.expo.dev/eas/environment-variables/),
scoped to the brand's EAS project and to `preview`/`production` separately:

```bash
eas env:create --environment preview    --name API_BASE_URL --value https://preview.example.com
eas env:create --environment preview    --name WS_URL       --value https://preview-realtime.example.com
eas env:create --environment production --name API_BASE_URL --value https://api.example.com
eas env:create --environment production --name WS_URL       --value https://realtime.example.com

# File-type secret — see docs/push-notifications.md for what this file is
eas env:create --environment preview    --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

`eas.json`'s `build.preview`/`build.production` profiles reference these via `"environment":
"preview"` / `"environment": "production"` — the build worker pulls the actual values at build
time, so `preview.example.com`-style placeholders never need to touch `eas.json` itself.

## Building

```bash
pnpm build:dev      # eas build --profile development — dev-client, internal
pnpm build:test      # eas build --profile preview — internal distribution, this is "TEST"
pnpm build:prod       # eas build --profile production — store-ready binary
```

Every build profile's `env.BRAND` defaults to `chatbotx` (`eas.json`'s `build.base`). Override it
for a customer brand:

```bash
BRAND=acme pnpm build:test
```

`BRAND` must be correct **at the machine that evaluates `app.config.ts`**, which for local builds
is your own shell, and for EAS Workflow builds is the job's `env.BRAND` (see
[white-label.md](white-label.md)) — a wrong value here silently builds into the wrong brand's EAS
project. `app.config.ts` logs `[app.config] brand=... appEnv=...` on every evaluation specifically
so this is visible in build logs.

## OTA updates

```bash
pnpm update:test    # eas update --channel preview    --environment preview
pnpm update:prod    # eas update --channel production --environment production
```

`runtimeVersion` uses the `appVersion` policy (see `app.config.ts`): an update is only offered to
installed builds that share the same `version`. If you add/upgrade a native module (anything that
changes generated `ios`/`android` code), bump `version` in `app.config.ts` and ship a new build —
an OTA update alone won't reach devices running the old native binary, and one published against a
mismatched `version` is silently never installed. Run `npx expo-doctor` (already part of CI) to
catch native/JS drift before it becomes a support ticket.

## Submitting to the stores

```bash
pnpm submit:prod   # eas submit --profile production (ios + android)
```

`eas.json`'s `submit.production` has no per-brand identifiers (Apple ID / ASC app id / team id,
Play service account) checked in — either let `eas submit` prompt interactively the first time (it
offers to save credentials to your EAS project), or set them as environment variables
(`EXPO_APPLE_ID`, etc. — see `eas submit --help` for the full list) before running non-interactively
in CI.

## Version bumping

`eas.json`'s `"appVersionSource": "remote"` means EAS tracks the build number remotely — you don't
hand-maintain `ios.buildNumber`/`android.versionCode`. You do still bump the semantic `version`
field in `app.config.ts` yourself whenever the app should be treated as a new release train (see
the runtime-version note above).

## Automated pipeline (EAS Workflows)

| File                         | Trigger                                            | What it does                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.eas/workflows/preview.yml` | push to `main`                                     | Builds `preview` profile, both platforms — this is the TEST distribution QA installs.                                                                                               |
| `.eas/workflows/update.yml`  | push to `main`; or manual with a `channel` input   | Publishes a JS-only OTA update (defaults to the `preview` channel; pick `production` manually).                                                                                     |
| `.eas/workflows/release.yml` | push of a `v*` tag; or manual with a `brand` input | Builds + submits a `production` binary for both stores. A non-default `brand` pulls that customer's brand overlay from a private repo first — see [white-label.md](white-label.md). |

CI (`.github/workflows/ci.yml`) triggers on `main` only. The repo's default branch must be `main`
for both CI and these workflows to fire on ordinary pushes.
