/** The `/v1` contact routes address a contact by a prefixed `{identifier}`; a plain database id is
 * written `id:<id>`. */
export function toContactIdentifier(contactId: string): string {
  return `id:${contactId}`;
}
