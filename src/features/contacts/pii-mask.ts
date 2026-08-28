/** Masks an email as `ab***@domain.com` — keeps the first 2 local-part chars and the domain so a
 * restricted member can still recognize a contact without seeing the full address. Splits on the
 * LAST `@` (not the first) since a quoted local-part can itself legally contain `@`. */
export function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0) return '***';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

/** Masks a phone number, keeping only the last 2 digits visible. Asterisk count is derived from
 * `digits` (not the raw string) so formatting characters (`-`, spaces, parens) don't inflate the
 * mask length beyond the actual digit count. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}
