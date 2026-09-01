/**
 * Client-side feature flags. No env override wiring exists yet — `app.config.ts`'s `extra` shape
 * has no `features` key, so this is a hardcoded constant until that's worth adding.
 *
 * `sendSequence`: the backend route needed to enroll a contact in a sequence
 * (`POST /workspaces/{workspaceId}/contacts/sequences`) doesn't exist yet — see
 * `src/features/sequences/api/use-enroll-contact-in-sequences.ts`. Flip to `true` once that route
 * ships and the hand-rolled fetch there is replaced with the generated client.
 *
 * `blockContact`/`deleteContact`: no session-auth routes exist yet — only the workspace-token
 * `blockContactWorkspaceTokenAPI`/`unblockContactWorkspaceTokenAPI` do, and there's no delete
 * route at all. See `use-contact-block.ts`/`use-delete-contact.ts`. Flip to `true` once
 * `POST/DELETE /workspaces/{workspaceId}/contacts/{contactId}/block|unblock|<delete>` ship under
 * bearer/session auth and `pnpm generate:api` has been re-run.
 */
export const FEATURES = {
  sendSequence: false,
  blockContact: false,
  deleteContact: false,
} as const;
