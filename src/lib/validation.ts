/** Loose email check — allows short TLDs like a@g.c */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Must contain @ with something before and after, and a dot in the domain part
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.') && !trimmed.includes(' ');
}
