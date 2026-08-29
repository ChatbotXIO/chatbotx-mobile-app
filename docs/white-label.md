# White-label: building this app for a different brand

The app is built once per customer ("brand") from the same codebase. A brand owns its own app
name, bundle id/package, colors, icons, and EAS project — nothing customer-specific is hardcoded
in application code. See [deploy.md](deploy.md) for the general build/update/submit flow; this doc
covers what's specific to standing up a _new_ brand.

## Who does this

The ChatbotX team builds and ships white-label apps for customers — customers don't get an EAS
account or build the app themselves. Each customer gets their own EAS project (in ChatbotX's
org), keeping their credentials, push certificates, and store listings isolated from every other
customer and from the open-source `chatbotx` brand.

## 1. Scaffold the brand

```bash
pnpm brand:new acme
```

This copies `brands/_template/` to `brands/acme/`, sets `id` to `acme` in the new
`brand.json`, and prints next steps. `brands/*` is gitignored except `brands/chatbotx/` and
`brands/_template/` — a new brand folder never gets committed to this (public) repo.

## 2. Fill in `brands/acme/brand.json`

```json
{
  "id": "acme",
  "displayName": "Acme Support",
  "slug": "acme-support",
  "scheme": "acmesupport",
  "ios": { "bundleIdentifier": "com.acme.support" },
  "android": { "package": "com.acme.support", "adaptiveIconBackgroundColor": "#0b1220" },
  "colors": { "brand": "#ff6a00", "splashBackground": "#0b1220" },
  "eas": { "projectId": "", "owner": "" }
}
```

- `scheme` becomes the app's custom URL scheme (`<scheme>://auth-callback` for social sign-in,
  `<scheme>://conversations/:id` for push-notification deep links) — must be globally unique and
  must be added to the backend's better-auth `trustedOrigins` for that customer's environment.
- `colors.brand` is the only color a brand needs to supply; `brandStrong` (pressed/emphasis state)
  is derived automatically (see `src/theme/tokens.ts`).
- Leave `eas.projectId` empty for now — step 4 fills it in.

## 3. Replace the assets

Replace every file in `brands/acme/assets/` with the customer's own art, keeping the same
filenames: `icon.png`, `splash-icon.png`, `android-icon-foreground.png`,
`android-icon-background.png`, `android-icon-monochrome.png`, `favicon.png`. Match the source
files in `brands/chatbotx/assets/` for dimensions/format.

## 4. Create the EAS project

```bash
BRAND=acme eas init
```

This creates a new EAS project scoped to this brand and writes the resulting `projectId` into
`brands/acme/brand.json` (not into an `app.json` — this repo has none, see `app.config.ts`).

## 5. Set environment variables and secrets

Same as the default brand, scoped to `acme`'s EAS project — see
[deploy.md](deploy.md#eas-environment-variables-per-brand-per-environment). This customer's
`API_BASE_URL`/`WS_URL` (if the backend is multi-tenant, these may be identical to another
customer's; if not, they're per-customer here) and Android `google-services.json` (from a Firebase
project registered with `com.acme.support[.dev|.preview]` — see
[push-notifications.md](push-notifications.md)) all live here, never in this repo.

## 6. Build and submit

```bash
BRAND=acme pnpm build:test    # internal TEST build for the customer/QA to try
BRAND=acme pnpm build:prod    # store-ready build
BRAND=acme pnpm submit:prod   # submit to that customer's App Store Connect / Play Console
```

Or trigger the `release` EAS Workflow manually with the `brand` input set to `acme` (see
[deploy.md](deploy.md#automated-pipeline-eas-workflows)) — this is the path used for a tagged
release when the brand isn't the default `chatbotx`.

## Where customer brand folders actually live

`brands/*` (other than `chatbotx` and `_template`) is gitignored in this repo on purpose — this
repo is open-source, and a customer's bundle id, EAS project id, and brand assets are not meant to
be public. The team keeps every customer's `brands/<id>/` folder in a separate private repository
(`chatbotx-mobile-brands`). The `release` EAS Workflow clones that private repo (using a
`BRANDS_REPO_TOKEN` EAS secret) into `brands/<id>/` at build time whenever `brand != chatbotx` —
see `.eas/workflows/release.yml`. Local development against a customer brand works the same way:
clone or copy that brand's folder from the private repo into `brands/<id>/` yourself before
running any `BRAND=<id>` command.

## Runtime (non-build-time) branding — not implemented here

Everything above is _build-time_: baked into the native binary (icon, splash, bundle id, scheme,
EAS project). A further layer — colors/logo/display name fetched from the backend's tenant
settings at app boot and cached locally, falling back to `brand.json` — is a deliberate follow-up,
not part of this app. `brand.json` and `src/config/brand.ts` are structured so that layer can read
the same shape later without a rework.
