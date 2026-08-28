# EAS Update

This app ships with `expo-updates` configured (`app.config.ts`'s `updates`/`runtimeVersion`), so
production/preview builds can receive OTA JS-bundle updates via `eas update` without an app-store
resubmission. `runtimeVersion` uses the `appVersion` policy — a build only receives updates
published against the same `version` in `app.config.ts`.
