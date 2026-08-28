# Regenerating the API client

```bash
pnpm generate:api
```

This fetches `{API_BASE_URL}/api/spec.json` (the full oRPC router spec, including the
bearer/session-authenticated routes the app needs — override with `API_SPEC_PATH` to point at the
workspace-token-only `/api/public-spec.json` instead) from a running backend instance and runs it
through `openapi-typescript` to produce `src/api/generated/schema.ts`, which `src/api/client.ts`
consumes via `openapi-fetch`.

The script is **not** wired into the build — the backend isn't guaranteed to be running, and this
repo must build without it. If the spec endpoint isn't reachable, the script prints a clear
message and exits non-zero without touching the previously generated file.
