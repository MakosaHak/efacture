/** Authentification par téléphone (commerçants Lomé / Togo) */

const PHONE_DOMAIN = 'phone.e-facture.app';

/** Chiffres uniquement, sans indicatif */
export function normalizePhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('228')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Format E.164 Togo (+228) */
export function toE164(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length !== 8) {
    throw new Error('Numéro togolais invalide (8 chiffres après +228).');
  }
  return `+228${digits}`;
}

/** Email interne Supabase (invisible pour l'utilisateur) */
export function phoneToInternalEmail(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  return `${digits}@${PHONE_DOMAIN}`;
}

export function formatPhoneDisplay(raw: string): string {
  const d = normalizePhoneDigits(raw);
  if (d.length !== 8) return raw;
  return `+228 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

export function validateTogoPhone(raw: string): boolean {
  const d = normalizePhoneDigits(raw);
  return /^[79]\d{7}$/.test(d);
}

/** Numéro de connexion à partir de l'email interne, ou null. */
export function loginPhoneFromInternalEmail(email?: string | null): string | null {
  if (!email) return null;
  const suffix = `@${PHONE_DOMAIN}`;
  if (!email.endsWith(suffix)) return null;
  const digits = email.slice(0, -suffix.length);
  if (!/^[79]\d{7}$/.test(digits)) return null;
  return formatPhoneDisplay(digits);
}
