/**
 * Prix de vente suggérés — « suggestion adaptative à moyenne mobile » (pas de machine learning).
 * Module pur : aucun accès réseau, aucune dépendance. Importé tel quel par scripts/verify-rules.mjs.
 */

/** Marge globale par défaut du commerçant (0.15 = 15 %). */
export const DEFAULT_MARGIN = 0.15;
/** Pas d'arrondi des prix de vente (FCFA). */
export const PRICE_STEP = 25;
/** Seuil de hausse du prix d'achat (%) au-delà duquel la ligne est « à vérifier ». */
const PRICE_INCREASE_THRESHOLD_PCT = 10;
/** Poids de l'ancienne marge dans la moyenne mobile. */
const MARGIN_MEMORY = 0.7;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** « Riz parfumé 25kg » et « riz  parfume 25 kg » → « riz parfume 25 kg ». */
function normalizeProductName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Arrondi au multiple de `step` le plus proche (1237 → 1225). */
function roundToStep(price: number, step = PRICE_STEP): number {
  const p = num(price);
  return p <= 0 ? 0 : Math.round(p / step) * step;
}

export function suggestSellingPrice(purchasePrice: number, margin: number): number {
  return roundToStep(num(purchasePrice) * (1 + num(margin)));
}

/**
 * Nouvelle marge = 0.7 × ancienne + 0.3 × marge réellement choisie, bornée à [0, 1].
 * Pas d'apprentissage si le prix d'achat est inconnu ou si le prix final est sous le coût.
 */
export function learnMargin(oldMargin: number, purchasePrice: number, finalPrice: number): number {
  const p = num(purchasePrice);
  const f = num(finalPrice);
  if (p <= 0 || f < p) return oldMargin;
  const real = f / p - 1;
  const next = MARGIN_MEMORY * num(oldMargin) + (1 - MARGIN_MEMORY) * real;
  return Math.round(Math.min(1, Math.max(0, next)) * 1e6) / 1e6;
}

/** Hausse du dernier prix d'achat de plus de 10 % par rapport au précédent. */
export function isPriceIncrease(
  lastPrice: number,
  previousPrice: number | null | undefined,
  thresholdPct = PRICE_INCREASE_THRESHOLD_PCT,
): boolean {
  const prev = num(previousPrice);
  return prev > 0 && ((num(lastPrice) - prev) / prev) * 100 > thresholdPct;
}

export interface ProductPurchase {
  product_key: string;
  product_name: string;
  unit_price: number;
}

/**
 * Regroupe les lignes d'une facture par produit normalisé.
 * Plusieurs lignes du même produit → prix unitaire moyen pondéré par la quantité
 * (moyenne simple si les quantités sont nulles).
 */
export function averagePurchasePrices(
  items: Array<{ product_name: string; quantity: number; unit_price: number }>,
): ProductPurchase[] {
  const groups = new Map<string, { name: string; qty: number; spent: number; prices: number[] }>();
  items.forEach((it) => {
    const key = normalizeProductName(it.product_name);
    const price = num(it.unit_price);
    if (!key || price <= 0) return;
    const g = groups.get(key) || { name: it.product_name.trim(), qty: 0, spent: 0, prices: [] };
    const qty = Math.max(0, num(it.quantity));
    g.qty += qty;
    g.spent += qty * price;
    g.prices.push(price);
    groups.set(key, g);
  });
  return [...groups.entries()].map(([product_key, g]) => ({
    product_key,
    product_name: g.name,
    unit_price:
      g.qty > 0 ? Math.round((g.spent / g.qty) * 100) / 100 : g.prices.reduce((s, v) => s + v, 0) / g.prices.length,
  }));
}

/**
 * Vérification croisée (scan) : total lu par l'IA vs somme des lignes (quantité × prix unitaire).
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
