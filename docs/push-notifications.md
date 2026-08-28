# Android push notifications (`google-services.json`)

Android FCM V1 push delivery requires a Firebase project with this app's package name
(`com.chatconnectx.mobile`) registered, and its `google-services.json` downloaded to the repo
root — the file is gitignored (per-developer/CI secret, never committed). `app.config.ts` only
references it conditionally (`existsSync` check), so a clean checkout without the file still
builds; Android push registration simply won't work until it's provisioned.

For EAS builds, upload it as a
[file-type secret](https://docs.expo.dev/eas/environment-variables/#file-environment-variables)
via `eas env:create` (or the EAS dashboard) referencing the path `./google-services.json`, rather
than committing it.
