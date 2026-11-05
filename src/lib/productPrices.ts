/**
 * Prix de vente suggérés — adaptateur démo / Supabase (même motif que invoices.ts).
 * Le calcul (pricing.ts) est pur et fonctionne hors ligne ; ici on ne fait que lire/écrire.
 */
import { supabase } from './supabase';
import { isDemoMode } from './demo/demo-mode';
import * as demo from './demo/demo-store';
import { fetchInvoice } from './invoices';
import {
  averagePurchasePrices,
  DEFAULT_MARGIN,
  isPriceIncrease,
  learnMargin,
  suggestSellingPrice,
} from './pricing';
import type { PriceSuggestion, ProductPrice } from '../types/invoice';

const COLUMNS =
  'product_key, product_name, margin, last_purchase_price, previous_purchase_price, suggested_price, selling_price, status, confirmations, updated_at';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Non connecté.');
  return data.user.id;
}

function toRow(raw: Record<string, unknown>): ProductPrice {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    product_key: String(raw.product_key),
    product_name: String(raw.product_name),
    margin: n(raw.margin),
    last_purchase_price: Number(raw.last_purchase_price) || 0,
    previous_purchase_price: n(raw.previous_purchase_price),
    suggested_price: Number(raw.suggested_price) || 0,
    selling_price: n(raw.selling_price),
    status: raw.status === 'confirmed' ? 'confirmed' : 'pending',
    confirmations: Number(raw.confirmations) || 0,
    updated_at: String(raw.updated_at || ''),
  };
}

async function loadRows(keys?: string[]): Promise<Map<string, ProductPrice>> {
  if (isDemoMode()) {
    const rows = demo.demoListProductPrices().filter((r) => !keys || keys.includes(r.product_key));
    return new Map(rows.map((r) => [r.product_key, r]));
  }
  const userId = await currentUserId();
  let query = supabase.from('product_prices').select(COLUMNS).eq('owner_id', userId);
  if (keys) query = query.in('product_key', keys);
  const { data, error } = await query;
  if (error) throw error;
  return new Map((data || []).map((raw) => [String(raw.product_key), toRow(raw)]));
}

async function saveRows(rows: ProductPrice[]): Promise<void> {
  if (!rows.length) return;
  if (isDemoMode()) {
    rows.forEach((r) => demo.demoSaveProductPrice(r));
    return;
  }
  const owner_id = await currentUserId();
  const { error } = await supabase
    .from('product_prices')
    .upsert(rows.map((r) => ({ ...r, owner_id })), { onConflict: 'owner_id,product_key' });
  if (error) throw error;
}

export async function getDefaultMargin(): Promise<number> {
  if (isDemoMode()) return demo.demoGetDefaultMargin();
  const userId = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('default_margin').eq('id', userId).maybeSingle();
  // Colonne absente (migration 005 non exécutée) : marge par défaut.
  if (error || data?.default_margin == null) return DEFAULT_MARGIN;
  return Number(data.default_margin);
}

export async function setDefaultMargin(value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('Marge invalide (entre 0 et 100 %).');
  }
  if (isDemoMode()) {
    demo.demoSetDefaultMargin(value);
    return;
  }
  const userId = await currentUserId();
  const { error } = await supabase.from('profiles').update({ default_margin: value }).eq('id', userId);
  if (error) throw error;
}

/**
 * Prépare (en arrière-plan) une suggestion par produit d'une facture validée.
 * Les factures en attente ou rejetées ne génèrent rien. Renvoie le nombre de produits traités.
 */
export async function preparePriceSuggestions(invoiceId: string): Promise<number> {
  const invoice = await fetchInvoice(invoiceId);
  if (!invoice || invoice.status !== 'validated') return 0;
  const purchases = averagePurchasePrices(invoice.invoice_items || []);
  if (!purchases.length) return 0;

  const [defaultMargin, existing] = await Promise.all([
    getDefaultMargin(),
    loadRows(purchases.map((p) => p.product_key)),
  ]);
  const now = new Date().toISOString();

  const rows = purchases.map((p): ProductPrice => {
    const prev = existing.get(p.product_key);
    // Même facture re-préparée (même prix, encore en attente) : ne pas écraser l'ancien prix d'achat.
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
  await saveRows(rows);
  return rows.length;
}

/** Suggestions en attente ; « À vérifier » (nouveau produit ou hausse > 10 %) d'abord. */
export async function listPriceSuggestions(): Promise<PriceSuggestion[]> {
  const rows = [...(await loadRows()).values()].filter((r) => r.status === 'pending');
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

/**
 * Confirme le prix de vente d'un produit et met à jour sa marge apprise (moyenne mobile).
 * Un prix sous le prix d'achat est accepté mais n'entraîne pas d'apprentissage.
 */
export async function confirmSellingPrice(
  productKey: string,
  finalPrice: number,
): Promise<{ margin: number | null; learned: boolean }> {
  const row = (await loadRows([productKey])).get(productKey);
  if (!row) throw new Error('Produit introuvable.');
  const price = Math.max(0, Number(finalPrice) || 0);
  const learned = row.last_purchase_price > 0 && price >= row.last_purchase_price;
  const margin = learned
    ? learnMargin(row.margin ?? (await getDefaultMargin()), row.last_purchase_price, price)
    : row.margin;

  await saveRows([
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

/** « Tout accepter » : chaque ligne compte comme une confirmation au prix suggéré. */
export async function acceptAllSuggestions(keys: string[]): Promise<void> {
  const rows = await loadRows(keys);
  for (const key of keys) {
    const row = rows.get(key);
    if (row?.status === 'pending') await confirmSellingPrice(key, row.suggested_price);
  }
}

export async function countPendingSuggestions(): Promise<number> {
  if (isDemoMode()) return demo.demoListProductPrices().filter((r) => r.status === 'pending').length;
  const userId = await currentUserId();
  const { count, error } = await supabase
    .from('product_prices')
    .select('product_key', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'pending');
  // Table absente (migration 005 non exécutée) : pas de badge plutôt qu'une erreur.
  return error ? 0 : count ?? 0;
}
