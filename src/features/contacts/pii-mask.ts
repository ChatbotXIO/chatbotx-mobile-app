/** Masks an email as `ab***@domain.com` — keeps the first 2 local-part chars and the domain so a
 * restricted member can still recognize a contact without seeing the full address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

/** Masks a phone number, keeping only the last 2 digits visible. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '*'.repeat(phone.length);
  return `${'*'.repeat(phone.length - 2)}${digits.slice(-2)}`;
}
