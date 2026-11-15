/** Authentification par téléphone (commerçants Lomé / Togo) */

/** Chiffres uniquement, sans indicatif */
export function normalizePhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('228')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
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

