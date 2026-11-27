interface InboxNamed {
  /** The connected page/account the contact reached us on. */
  inbox?: { name?: string | null } | null;
}

/** Name of the connected page/account (e.g. "AhaChat") for a contact inbox, trimmed. Returns
 * `null` when unknown or blank so every surface treats a whitespace-only name as absent. */
export function inboxNameOf(contactInbox: InboxNamed | null | undefined): string | null {
  return contactInbox?.inbox?.name?.trim() || null;
}
