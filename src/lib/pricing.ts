/**
 * Prix de vente unitaire conseillé.
 * Miroir client de la fonction SQL fill_invoice_item_pricing (supabase/migrations/003_selling_price.sql).
 * Sans dépendance : importable tel quel par scripts/verify-pricing.ts.
 */

export const DEFAULT_MARGIN_PCT = 15;
/** Palier d'arrondi du marché (Lomé) : 632 F → 650 F. */
export const PRICE_ROUNDING_STEP = 50;
/** Seuil critique : une hausse du prix d'achat strictement supérieure déclenche l'alerte. */
export const PRICE_INCREASE_ALERT_PCT = 5;

export interface ItemPricing {
  sous_total: number;
  frais_transport_attribues: number;
  cout_de_revient_unitaire: number;
  prix_de_vente_conseille: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function roundUpPrice(amount: number, step = PRICE_ROUNDING_STEP): number {
  if (!(amount > 0)) return 0;
  // la tolérance évite 650.0000001 → 700
  return Math.ceil(amount / step - 1e-9) * step;
}

export function sellingPrice(unitCost: number, marginPct: number, step = PRICE_ROUNDING_STEP): number {
  return roundUpPrice(num(unitCost) * (1 + Math.max(0, num(marginPct)) / 100), step);
}

/**
 * part_transport = (sous_total / montant_total_facture) × frais_transport
 * coût de revient = prix_unitaire + part_transport / quantité
 * PV conseillé   = coût de revient × (1 + marge / 100), arrondi au palier supérieur
 * Si le montant facture est illisible (≤ 0), la somme des lignes sert de base.
 */
export function computeItemsPricing(
  items: Array<{ quantity: number; unit_price: number }>,
  opts: { invoiceTotal: number; transportFee: number; marginPct: number; step?: number },
): ItemPricing[] {
  const transport = Math.max(0, num(opts.transportFee));
  const subTotals = items.map((it) => Math.max(0, num(it.quantity)) * num(it.unit_price));
  const base = num(opts.invoiceTotal) > 0 ? num(opts.invoiceTotal) : subTotals.reduce((s, v) => s + v, 0);

  return items.map((it, i) => {
    const quantity = Math.max(0, num(it.quantity));
    const sous_total = subTotals[i];
    const part = base > 0 ? (sous_total / base) * transport : 0;
    const cout = num(it.unit_price) + (quantity > 0 ? part / quantity : 0);
    return {
      sous_total,
      frais_transport_attribues: round2(part),
      cout_de_revient_unitaire: round2(cout),
      prix_de_vente_conseille: sellingPrice(cout, opts.marginPct, opts.step),
    };
  });
}

/** Clé de rapprochement d'un produit entre factures (casse, accents, espaces). */
export function productKey(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Variation en % du prix d'achat ; null si la hausse ne dépasse pas le seuil critique. */
export function priceIncreasePct(current: number, previous: number): number | null {
  if (!(previous > 0) || !(current > 0)) return null;
  const pct = ((current - previous) / previous) * 100;
  return pct > PRICE_INCREASE_ALERT_PCT ? Math.round(pct * 10) / 10 : null;
}

/**
 * Vérification croisée : total lu par l'IA vs somme des lignes (quantité × prix unitaire).
 * gap > 0 : des lignes manquent probablement ; gap < 0 : lignes en trop ou total mal lu.
 */
export function invoiceTotalGap(
  invoiceTotal: number,
  items: Array<{ quantity: number; unit_price: number }>,
): { linesSum: number; gap: number; mismatch: boolean } {
  const linesSum = Math.round(items.reduce((s, it) => s + num(it.quantity) * num(it.unit_price), 0));
  const total = Math.round(num(invoiceTotal));
  const gap = total - linesSum;
  return { linesSum, gap, mismatch: items.length > 0 && total > 0 && Math.abs(gap) >= 1 };
}
