# Push notifications (`google-services.json`)

Android FCM V1 push delivery requires a Firebase project with this build's package name
registered, and its `google-services.json` downloaded to the repo root — the file is gitignored
(per-developer/CI secret, never committed). `app.config.ts` only references it conditionally
(`existsSync` check), so a clean checkout without the file still builds; Android push registration
simply won't work until it's provisioned.

The package name is brand- and environment-specific:
`<brands/BRAND/brand.json .android.package><APP_ENV suffix>` (e.g.
`com.chatconnectx.mobile.preview` for the default brand's `preview`/TEST builds,
`com.chatconnectx.mobile` for `production` — see `app.config.ts`'s `APP_ENV_CONFIG`). **Each
`APP_ENV` suffix needs its own entry in the Firebase project** — a single `google-services.json`
can contain multiple package names, or you can register each as a separate Android app within the
same Firebase project and merge the resulting config. Skipping this means push silently fails to
register for whichever suffix wasn't added.

For EAS builds, upload it as a
[file-type secret](https://docs.expo.dev/eas/environment-variables/#file-environment-variables)
via `eas env:create` (or the EAS dashboard) referencing the path `./google-services.json`, rather
than committing it — see [deploy.md](deploy.md#eas-environment-variables-per-brand-per-environment).
It's scoped per brand's EAS project, same as `API_BASE_URL`/`WS_URL`; a white-label customer needs
their own Firebase project registered with their own (brand-specific) package name — see
[white-label.md](white-label.md).

iOS push doesn't need an equivalent file here: Expo push notifications route through APNs using
credentials EAS manages as part of the iOS build credentials, not a bundled config file.
