/** Libellé d’affichage quand le ticket n’a pas de nom de vendeur. */
export const UNKNOWN_SUPPLIER = 'Sans fournisseur';

export function isNamedSupplier(name: string | null | undefined): boolean {
  const t = (name || '').trim().toLowerCase();
  if (!t) return false;
  return t !== 'sans fournisseur' && t !== 'inconnu' && t !== 'n/a' && t !== '-' && t !== 'aucun';
}

export function displaySupplier(name: string | null | undefined): string {
  const t = (name || '').trim();
  return isNamedSupplier(t) ? t : UNKNOWN_SUPPLIER;
}

/** Valeur stockée : nom saisi, ou chaîne vide si inconnu. */
export function normalizeSupplierName(name: string | null | undefined): string {
  const t = (name || '').trim();
  return isNamedSupplier(t) ? t : '';
}
