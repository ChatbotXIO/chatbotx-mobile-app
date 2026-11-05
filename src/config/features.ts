/**
 * Client-side feature flags. No env override wiring exists yet — `app.config.ts`'s `extra` shape
 * has no `features` key, so this is a hardcoded constant until that's worth adding.
 *
 * Block/unblock, delete and sequence enrollment are all served by the public `/v1` API now, so
 * every flag is on. The flags stay as a kill-switch for the UI entry points.
 */
export const FEATURES = {
  sendSequence: true,
  blockContact: true,
  deleteContact: true,
} as const;
