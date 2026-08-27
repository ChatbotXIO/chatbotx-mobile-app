/**
 * Client-side feature flags. No env override wiring exists yet — `app.config.ts`'s `extra` shape
 * has no `features` key, so this is a hardcoded constant until that's worth adding.
 *
 * `sendSequence`: the backend route needed to enroll a contact in a sequence
 * (`POST /workspaces/{workspaceId}/contacts/sequences`) doesn't exist yet — see
 * `src/features/sequences/api/use-enroll-contact-in-sequences.ts`. Flip to `true` once that route
 * ships and the hand-rolled fetch there is replaced with the generated client.
 */
export const FEATURES = {
  sendSequence: false,
} as const;
