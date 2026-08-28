# Realtime event types

`src/realtime/events.ts` mirrors the backend's realtime event type definitions **by hand**. This
app lives in a separate git repository from the backend (not a shared pnpm workspace), so there's
no live cross-repo import — copying types in is the intentionally simple, non-fragile choice over
a symlink or git submodule. Only type-only shapes are mirrored; no server-side code is referenced.

When the backend's event schemas change, re-copy the updated shapes by hand. The header comment in
`src/realtime/events.ts` notes which commit it was last synced against.
