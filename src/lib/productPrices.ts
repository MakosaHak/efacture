/**
 * Prix de vente suggérés — lecture/écriture dans la base locale.
 * Le calcul (pricing.ts) est pur ; ici on ne fait que persister.
 */
import { listProductPrices, putProductPrices, getSetting, putSetting, getInvoice } from './db/repo';
import {
  averagePurchasePrices,
  DEFAULT_MARGIN,
  isPriceIncrease,
  learnMargin,
  suggestSellingPrice,
} from './pricing';
import type { PriceSuggestion, ProductPrice } from '../types/invoice';

async function loadRows(ownerId: string, keys?: string[]): Promise<Map<string, ProductPrice>> {
  const rows = (await listProductPrices(ownerId)).filter((r) => !keys || keys.includes(r.product_key));
  return new Map(rows.map((r) => [r.product_key, r]));
}

export async function getDefaultMargin(ownerId: string): Promise<number> {
  const v = await getSetting<number>(ownerId, 'default_margin');
  return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_MARGIN;
}

export async function setDefaultMargin(ownerId: string, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('Marge invalide (entre 0 et 100 %).');
  }
  await putSetting(ownerId, 'default_margin', value);
}

/**
 * Prépare une suggestion par produit d'une facture validée.
 * Renvoie le nombre de produits traités.
 */
export async function preparePriceSuggestions(ownerId: string, invoiceId: string): Promise<number> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.status !== 'validated') return 0;
  const purchases = averagePurchasePrices(invoice.invoice_items || []);
  if (!purchases.length) return 0;

  const [defaultMargin, existing] = await Promise.all([
    getDefaultMargin(ownerId),
    loadRows(ownerId, purchases.map((p) => p.product_key)),
  ]);
  const now = new Date().toISOString();

  const rows = purchases.map((p): ProductPrice => {
    const prev = existing.get(p.product_key);
    const replay = prev?.status === 'pending' && prev.last_purchase_price === p.unit_price;
    return {
      product_key: p.product_key,
      product_name: p.product_name,
      margin: prev?.margin ?? null,
      last_purchase_price: p.unit_price,
      previous_purchase_price: replay ? prev.previous_purchase_price : (prev?.last_purchase_price ?? null),
      suggested_price: suggestSellingPrice(p.unit_price, prev?.margin ?? defaultMargin),
      selling_price: prev?.selling_price ?? null,
      status: 'pending',
      confirmations: prev?.confirmations ?? 0,
      updated_at: now,
    };
  });
  await putProductPrices(ownerId, rows);
  return rows.length;
}

/** Suggestions en attente ; « À vérifier » (nouveau produit ou hausse > 10 %) d'abord. */
export async function listPriceSuggestions(ownerId: string): Promise<PriceSuggestion[]> {
  const rows = [...(await loadRows(ownerId)).values()].filter((r) => r.status === 'pending');
  return rows
    .map((r) => {
      const is_new = r.selling_price == null;
      const is_increase = isPriceIncrease(r.last_purchase_price, r.previous_purchase_price);
      return { ...r, is_new, is_increase, needs_review: is_new || is_increase };
    })
    .sort(
      (a, b) =>
        Number(b.needs_review) - Number(a.needs_review) || a.product_name.localeCompare(b.product_name, 'fr'),
    );
}

/** Tous les prix connus (confirmés ou en attente), pour l'écran de consultation. */
export async function listAllProductPrices(ownerId: string): Promise<ProductPrice[]> {
  return [...(await loadRows(ownerId)).values()].sort((a, b) => a.product_name.localeCompare(b.product_name, 'fr'));
}

export async function confirmSellingPrice(
  ownerId: string,
  productKey: string,
  finalPrice: number,
): Promise<{ margin: number | null; learned: boolean }> {
  const row = (await loadRows(ownerId, [productKey])).get(productKey);
  if (!row) throw new Error('Produit introuvable.');
  const price = Math.max(0, Number(finalPrice) || 0);
  const learned = row.last_purchase_price > 0 && price >= row.last_purchase_price;
  const margin = learned
    ? learnMargin(row.margin ?? (await getDefaultMargin(ownerId)), row.last_purchase_price, price)
    : row.margin;

  await putProductPrices(ownerId, [
    {
      ...row,
      margin,
      selling_price: price,
      status: 'confirmed',
      confirmations: row.confirmations + 1,
      updated_at: new Date().toISOString(),
    },
  ]);
  return { margin, learned };
}

export async function acceptAllSuggestions(ownerId: string, keys: string[]): Promise<void> {
  const rows = await loadRows(ownerId, keys);
  for (const key of keys) {
    const row = rows.get(key);
    if (row?.status === 'pending') await confirmSellingPrice(ownerId, key, row.suggested_price);
  }
}

export async function countPendingSuggestions(ownerId: string): Promise<number> {
  return (await listProductPrices(ownerId)).filter((r) => r.status === 'pending').length;
}
