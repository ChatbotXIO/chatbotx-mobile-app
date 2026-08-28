# EAS Update

This app ships with `expo-updates` configured (`app.config.ts`'s `updates`/`runtimeVersion`), so
`preview`/`production` builds can receive OTA JS-bundle updates via `eas update` without an
app-store resubmission. `runtimeVersion` uses the `appVersion` policy — a build only receives
updates published against the same `version` in `app.config.ts`.

Each `APP_ENV` maps to its own update channel (`development`/`preview`/`production` — see
`app.config.ts`'s `APP_ENV_CONFIG`), so a `preview` (TEST) build never receives a `production`
update and vice versa. See [deploy.md](deploy.md#ota-updates) for the actual publish commands
(`pnpm update:test` / `pnpm update:prod`) and the EAS Workflow that automates the common case
(`.eas/workflows/update.yml`).

`updates.url`/`extra.eas.projectId` are per-brand (`brands/<BRAND>/brand.json`) — a brand with no
EAS project yet has neither, and `expo-updates` is effectively inert until `eas init` is run for
that brand (see [white-label.md](white-label.md)).
