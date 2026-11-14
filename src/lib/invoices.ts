/**
 * Factures : lecture/écriture dans la base locale (IndexedDB) et calculs
 * d'analyse (dépenses, prix, prévisions, optimisation) à partir des factures
 * validées du compte.
 */
import {
  getInvoice as repoGetInvoice,
  getPhotoBlob,
  listInvoices,
  listValidatedInvoices,
  putInvoice,
  putPhoto,
  removeInvoice,
  removePhoto,
} from './db/repo';
import { fitLinearNext, formatMonthLong, mean, monthlyGrowthRate, nextMonthLabel, slopeToMonthlyPct } from './predict';
import { allocateTransport, invoiceLandedTotal, transportFeeOf } from './landed-cost';
import { displaySupplier, isNamedSupplier, normalizeSupplierName, UNKNOWN_SUPPLIER } from './supplier';
import { preparePriceSuggestions } from './productPrices';
import type {
  Invoice,
  InvoiceItem,
  MonthlyKpis,
  OCRResult,
  SpendingTotals,
  PriceAlert,
  PriceEvolutionPoint,
  ProductForecast,
  SpendingForecast,
  FinancialOptimization,
  ProductSaving,
  SupplierPriceForecast,
  SupplierSpending,
  TopProduct,
} from '../types/invoice';

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/** URL d'objet vers la photo locale. L'appelant la révoque quand il n'en a plus besoin. */
export async function getPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const blob = await getPhotoBlob(path);
  return blob ? URL.createObjectURL(blob) : null;
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function fetchInvoices(ownerId: string, search = '', status = ''): Promise<Invoice[]> {
  let list = await listInvoices(ownerId);
  if (status) list = list.filter((i) => i.status === status);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (i) =>
        displaySupplier(i.supplier_name_raw).toLowerCase().includes(q) ||
        (i.invoice_items || []).some((it) => it.product_name.toLowerCase().includes(q)) ||
        i.notes.toLowerCase().includes(q),
    );
  }
  return list;
}

export async function fetchInvoice(id: string): Promise<Invoice | null> {
  return (await repoGetInvoice(id)) ?? null;
}

export async function saveScannedInvoice(ownerId: string, file: Blob, ocr: OCRResult): Promise<string> {
  const invoiceId = crypto.randomUUID();
  const photo_path = await putPhoto(`${ownerId}-${invoiceId}`, file, ownerId);
  const now = new Date().toISOString();

  const items: InvoiceItem[] = ocr.items.map((item, idx) => ({
    id: `${invoiceId}-${idx}`,
    invoice_id: invoiceId,
    product_name: item.product_name,
    quantity: parseFloat(item.quantity) || 1,
    unit: item.unit || 'pièce',
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0,
  }));

  await putInvoice({
    id: invoiceId,
    owner_id: ownerId,
    supplier_id: null,
    supplier_name_raw: normalizeSupplierName(ocr.supplier_name),
    invoice_date: ocr.invoice_date || null,
    total_amount: parseFloat(ocr.total_amount) || 0,
    transport_fee: 0,
    photo_path,
    status: 'pending',
    ocr_raw_data: { provider: ocr.provider, confidence: ocr.confidence, raw_text: ocr.raw_text, transport_fee: 0 },
    notes: ocr.confidence < 0.3 ? 'Lecture incertaine, vérifiez les champs.' : '',
    created_at: now,
    updated_at: now,
    invoice_items: items,
  });
  return invoiceId;
}

export async function validateInvoice(
  invoiceId: string,
  data: {
    supplier_name_raw: string;
    invoice_date: string | null;
    total_amount: number;
    transport_fee: number;
    notes: string;
    items: InvoiceItem[];
  },
): Promise<void> {
  const existing = await repoGetInvoice(invoiceId);
  if (!existing) throw new Error('Facture introuvable');
  const transport_fee = Math.max(0, Number(data.transport_fee) || 0);
  const next: Invoice = {
    ...existing,
    supplier_name_raw: normalizeSupplierName(data.supplier_name_raw),
    invoice_date: data.invoice_date,
    total_amount: Number(data.total_amount) || 0,
    transport_fee,
    ocr_raw_data: { ...existing.ocr_raw_data, transport_fee },
    notes: data.notes,
    status: 'validated',
    updated_at: new Date().toISOString(),
    invoice_items: data.items.map((item, i) => ({
      ...item,
      id: item.id || `${invoiceId}-${i}`,
      invoice_id: invoiceId,
      total_price: item.total_price || item.quantity * item.unit_price,
    })),
  };
  await putInvoice(next);
  try {
    await preparePriceSuggestions(existing.owner_id, invoiceId);
  } catch (err) {
    console.warn('Prix de vente suggérés non préparés :', err);
  }
}

export async function updateInvoiceSupplier(invoiceId: string, supplierNameRaw: string): Promise<void> {
  const existing = await repoGetInvoice(invoiceId);
  if (!existing) throw new Error('Facture introuvable');
  await putInvoice({
    ...existing,
    supplier_name_raw: normalizeSupplierName(supplierNameRaw),
    updated_at: new Date().toISOString(),
  });
}

export async function getKnownSupplierNames(ownerId: string): Promise<string[]> {
  const names = new Set<string>();
  (await listValidatedInvoices(ownerId)).forEach((inv) => {
    if (isNamedSupplier(inv.supplier_name_raw)) names.add(inv.supplier_name_raw.trim());
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

export async function rejectInvoice(invoiceId: string): Promise<void> {
  const existing = await repoGetInvoice(invoiceId);
  if (!existing) return;
  await putInvoice({ ...existing, status: 'rejected', updated_at: new Date().toISOString() });
}

export async function deleteInvoice(invoiceId: string, photoPath: string): Promise<void> {
  const existing = await repoGetInvoice(invoiceId);
  if (photoPath) await removePhoto(photoPath, existing?.owner_id);
  await removeInvoice(invoiceId);
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getMonthlyKpis(ownerId: string): Promise<MonthlyKpis> {
  const start = startOfMonth();
  const rows = (await listValidatedInvoices(ownerId)).filter((inv) => new Date(inv.created_at) >= start);
  const total = rows.reduce((s, inv) => s + invoiceLandedTotal(inv), 0);
  return { total_spent: total, invoice_count: rows.length, avg_amount: rows.length ? total / rows.length : 0 };
}

/** Dépenses (facture + transport) du jour, de la semaine (lundi → aujourd'hui) et du mois. */
export async function getSpendingTotals(ownerId: string): Promise<SpendingTotals> {
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startDay);
  startWeek.setDate(startDay.getDate() - ((startDay.getDay() + 6) % 7));
  const startMonth = startOfMonth(now);
  const rows = await listValidatedInvoices(ownerId);
  const sumSince = (start: Date) =>
    rows.filter((r) => new Date(r.created_at) >= start).reduce((s, r) => s + invoiceLandedTotal(r), 0);
  return { day: sumSince(startDay), week: sumSince(startWeek), month: sumSince(startMonth) };
}

export async function getMonthOverMonthChange(ownerId: string): Promise<number> {
  const now = new Date();
  const startCurrent = startOfMonth(now);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rows = await listValidatedInvoices(ownerId);
  const cur = rows.filter((r) => new Date(r.created_at) >= startCurrent).reduce((s, r) => s + invoiceLandedTotal(r), 0);
  const prev = rows
    .filter((r) => new Date(r.created_at) >= startPrev && new Date(r.created_at) < startCurrent)
    .reduce((s, r) => s + invoiceLandedTotal(r), 0);
  if (prev <= 0) return cur <= 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

export async function getRecentPurchases(ownerId: string, limit = 5): Promise<Invoice[]> {
  return (await listValidatedInvoices(ownerId)).slice(0, limit);
}

export async function getPendingInvoices(ownerId: string): Promise<Invoice[]> {
  return (await listInvoices(ownerId)).filter((inv) => inv.status === 'pending');
}

export async function getValidatedInvoicesForMonth(ownerId: string, year: number, month: number): Promise<Invoice[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  return (await listValidatedInvoices(ownerId))
    .filter((inv) => invoiceMonth(inv) === ym)
    .sort((a, b) => String(b.invoice_date || b.created_at).localeCompare(String(a.invoice_date || a.created_at)));
}

export async function getTopProducts(ownerId: string, limit = 20): Promise<TopProduct[]> {
  const items = (await listValidatedInvoices(ownerId)).flatMap((inv) => inv.invoice_items || []);
  const map = new Map<string, { qty: number; prices: number[]; count: number }>();
  items.forEach((item) => {
    const entry = map.get(item.product_name) || { qty: 0, prices: [], count: 0 };
    entry.qty += Number(item.quantity);
    entry.prices.push(Number(item.unit_price));
    entry.count += 1;
    map.set(item.product_name, entry);
  });
  return Array.from(map.entries())
    .map(([product_name, v]) => ({
      product_name,
      total_qty: v.qty,
      avg_price: v.prices.reduce((a, b) => a + b, 0) / v.prices.length,
      purchase_count: v.count,
    }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, limit);
}

export async function getPriceEvolution(ownerId: string, productName: string, months = 6): Promise<PriceEvolutionPoint[]> {
  const monthly: Record<string, number[]> = {};
  (await listValidatedInvoices(ownerId)).forEach((inv) => {
    (inv.invoice_items || []).forEach((item) => {
      if (!item.product_name.toLowerCase().includes(productName.toLowerCase())) return;
      const month = invoiceMonth(inv);
      (monthly[month] ||= []).push(Number(item.unit_price));
    });
  });
  return Object.keys(monthly)
    .sort()
    .slice(-months)
    .map((month) => ({
      month,
      avg_price: monthly[month].reduce((a, b) => a + b, 0) / monthly[month].length,
      count: monthly[month].length,
    }));
}

export async function getPriceAlerts(ownerId: string, threshold = 5): Promise<PriceAlert[]> {
  const products = await getTopProducts(ownerId, 50);
  const alerts: PriceAlert[] = [];
  for (const product of products) {
    const evolution = await getPriceEvolution(ownerId, product.product_name, 6);
    if (evolution.length < 2) continue;
    const first = evolution[0].avg_price;
    const last = evolution[evolution.length - 1].avg_price;
    if (first <= 0) continue;
    const change = ((last - first) / first) * 100;
    if (change >= threshold) {
      alerts.push({
        product_name: product.product_name,
        first_price: first,
        last_price: last,
        change_pct: Math.round(change * 10) / 10,
      });
    }
  }
  return alerts.sort((a, b) => b.change_pct - a.change_pct);
}

export async function getSpendingBySupplier(ownerId: string, months = 3): Promise<SupplierSpending[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - months * 30);
  const map = new Map<string, { total: number; count: number }>();
  (await listValidatedInvoices(ownerId))
    .filter((inv) => new Date(inv.created_at) >= cutoff)
    .forEach((inv) => {
      const name = displaySupplier(inv.supplier_name_raw);
      const e = map.get(name) || { total: 0, count: 0 };
      e.total += invoiceLandedTotal(inv);
      e.count += 1;
      map.set(name, e);
    });
  return Array.from(map.entries())
    .map(([supplier_name_raw, v]) => ({ supplier_name_raw, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

/** Montant sans l'unité, pour les gros chiffres où « FCFA » est affiché à part. */
export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('fr-FR');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function invoiceMonth(inv: { invoice_date: string | null; created_at: string }): string {
  return String(inv.invoice_date || inv.created_at).slice(0, 7);
}

export async function getMonthlySpendingSeries(ownerId: string, months = 6): Promise<{ month: string; total: number }[]> {
  const map = new Map<string, number>();
  (await listValidatedInvoices(ownerId)).forEach((inv) => {
    const month = invoiceMonth(inv);
    map.set(month, (map.get(month) || 0) + invoiceLandedTotal(inv));
  });
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
}

export async function getSpendingForecast(ownerId: string): Promise<SpendingForecast | null> {
  const history = await getMonthlySpendingSeries(ownerId, 6);
  if (history.length < 2) return null;

  const last3 = history.slice(-3);
  const avg3 = mean(last3.map((h) => h.total));

  const products = await getTopProducts(ownerId, 15);
  const rates: number[] = [];
  for (const product of products) {
    const evo = await getPriceEvolution(ownerId, product.product_name, 6);
    const rate = monthlyGrowthRate(evo.map((p) => p.avg_price));
    if (rate !== null) rates.push(rate);
  }
  const inflation = rates.length ? mean(rates) : 0;
  const predicted = Math.max(0, avg3 * (1 + inflation));
  const fit = fitLinearNext(history.map((h) => h.total));
  const last = history[history.length - 1].month;
  const predicted_month = nextMonthLabel(last);
  const inflation_pct = Math.round(inflation * 1000) / 10;
  const predicted_total = Math.round(predicted);
  const sign = inflation_pct >= 0 ? '+' : '';

  return {
    history,
    predicted_month,
    predicted_total,
    avg_3m: Math.round(avg3),
    inflation_pct,
    slope: fit?.slope ?? 0,
    r2: fit?.r2 ?? 0,
    n: history.length,
    summary: `D'après vos achats passés et l'évolution récente des prix (${sign}${inflation_pct} %), prévoyez environ ${formatFcfa(predicted_total)} de budget d'achat pour ${formatMonthLong(predicted_month)}.`,
  };
}

function monthlyAvgSeries(points: { month: string; price: number }[]): number[] {
  const map = new Map<string, number[]>();
  points.forEach((p) => {
    const arr = map.get(p.month) || [];
    arr.push(p.price);
    map.set(p.month, arr);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, prices]) => mean(prices));
}

function forecastFromSeries(series: number[]): { last: number; predicted: number; monthly_pct: number; slope: number; r2: number; n: number } | null {
  if (!series.length) return null;
  const last = series[series.length - 1];
  const fit = fitLinearNext(series);
  if (fit) {
    return {
      last,
      predicted: Math.round(fit.predicted),
      monthly_pct: Math.round(slopeToMonthlyPct(fit.slope, last) * 10) / 10,
      slope: fit.slope,
      r2: fit.r2,
      n: fit.n,
    };
  }
  return { last, predicted: Math.round(last), monthly_pct: 0, slope: 0, r2: 0, n: series.length };
}

export async function getProductPriceForecasts(ownerId: string, limit = 5): Promise<ProductForecast[]> {
  const products = await getTopProducts(ownerId, 12);
  const lines = await getValidatedPurchaseLines(ownerId);
  const out: ProductForecast[] = [];

  for (const product of products) {
    const evo = await getPriceEvolution(ownerId, product.product_name, 8);
    const overall = forecastFromSeries(evo.map((p) => p.avg_price));
    if (!overall || evo.length < 2) continue;

    const related = lines.filter((l) => l.product_name.trim().toLowerCase() === product.product_name.trim().toLowerCase());
    const byName = new Map<string, PurchaseLine[]>();
    related.forEach((l) => {
      if (!isNamedSupplier(l.supplier)) return;
      const arr = byName.get(l.supplier) || [];
      arr.push(l);
      byName.set(l.supplier, arr);
    });

    const by_supplier: SupplierPriceForecast[] = [...byName.entries()]
      .map(([name, plist]) => {
        const f = forecastFromSeries(monthlyAvgSeries(plist.map((l) => ({ month: l.month, price: l.unit_price }))));
        if (!f) return null;
        return { name, last_price: f.last, predicted_price: f.predicted, monthly_pct: f.monthly_pct, n: f.n };
      })
      .filter((s): s is SupplierPriceForecast => s !== null)
      .sort((a, b) => a.predicted_price - b.predicted_price);

    out.push({
      product_name: product.product_name,
      last_price: overall.last,
      predicted_price: overall.predicted,
      monthly_pct: overall.monthly_pct,
      slope: overall.slope,
      r2: overall.r2,
      n: overall.n,
      best_supplier: by_supplier[0]?.name ?? null,
      by_supplier,
    });
  }
  return out.slice(0, limit);
}

type PurchaseLine = {
  product_name: string;
  supplier: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  month: string;
};

async function getValidatedPurchaseLines(ownerId: string): Promise<PurchaseLine[]> {
  return (await listValidatedInvoices(ownerId)).flatMap((inv) => {
    const items = inv.invoice_items || [];
    const costs = allocateTransport(items, transportFeeOf(inv));
    const supplier = displaySupplier(inv.supplier_name_raw);
    const month = invoiceMonth(inv);
    return items.map((item, i) => ({
      product_name: item.product_name,
      supplier,
      quantity: costs[i].quantity,
      unit_price: costs[i].unit_landed_cost,
      total_price: costs[i].line_landed_cost,
      month,
    }));
  });
}

export async function getFinancialOptimization(ownerId: string): Promise<FinancialOptimization | null> {
  const lines = (await getValidatedPurchaseLines(ownerId)).filter(
    (l) => l.quantity > 0 && l.unit_price > 0 && l.product_name.trim(),
  );
  if (!lines.length) return null;

  const byProduct = new Map<string, PurchaseLine[]>();
  lines.forEach((l) => {
    const key = l.product_name.trim();
    const arr = byProduct.get(key) || [];
    arr.push(l);
    byProduct.set(key, arr);
  });

  const unnamed_count = lines.filter((l) => !isNamedSupplier(l.supplier)).length;
  let unnamedCheaper = false;
  const products: ProductSaving[] = [];
  for (const [product_name, plist] of byProduct) {
    const bySupplier = new Map<string, { qty: number; spent: number }>();
    plist.forEach((l) => {
      const e = bySupplier.get(l.supplier) || { qty: 0, spent: 0 };
      e.qty += l.quantity;
      e.spent += l.total_price;
      bySupplier.set(l.supplier, e);
    });
    const suppliers = [...bySupplier.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, avg_price: v.qty > 0 ? v.spent / v.qty : 0 }))
      .filter((s) => s.avg_price > 0)
      .sort((a, b) => a.avg_price - b.avg_price);
    if (!suppliers.length) continue;

    const named = suppliers.filter((s) => isNamedSupplier(s.name));
    const unnamed = suppliers.find((s) => !isNamedSupplier(s.name));
    const cheapestNamed = named[0];
    const actual_spent = plist.reduce((s, l) => s + l.total_price, 0);
    const qty = plist.reduce((s, l) => s + l.quantity, 0);

    const cheapest_supplier = cheapestNamed?.name || UNKNOWN_SUPPLIER;
    const cheapest_unit_price = cheapestNamed?.avg_price || 0;
    const optimized_spent = cheapestNamed ? qty * cheapestNamed.avg_price : actual_spent;
    const savings = Math.max(0, actual_spent - optimized_spent);
    products.push({ product_name, qty, actual_spent, optimized_spent, savings, cheapest_supplier, cheapest_unit_price, suppliers });
    if (unnamed && cheapestNamed && unnamed.avg_price + 1 < cheapestNamed.avg_price) unnamedCheaper = true;
  }

  products.sort((a, b) => b.savings - a.savings);
  const actual_spent = products.reduce((s, p) => s + p.actual_spent, 0);
  const optimized_spent = products.reduce((s, p) => s + p.optimized_spent, 0);
  const potential_savings = Math.max(0, actual_spent - optimized_spent);
  const savings_pct = actual_spent > 0 ? (potential_savings / actual_spent) * 100 : 0;

  const advice: string[] = [];
  if (unnamedCheaper) {
    advice.push('Certains tickets sans nom de vendeur sont moins chers que vos fournisseurs identifiés. Notez le nom du vendeur pour en faire un conseil.');
  }
  const withSaving = products.filter(
    (p) => p.savings >= 1 && isNamedSupplier(p.cheapest_supplier) && p.suppliers.filter((s) => isNamedSupplier(s.name)).length >= 1,
  );
  withSaving.slice(0, 3).forEach((p) => {
    advice.push(`Privilégier ${p.cheapest_supplier} pour ${p.product_name} (${formatFcfa(p.cheapest_unit_price)} / unité).`);
  });

  const forecasts = await getProductPriceForecasts(ownerId, 8);
  forecasts
    .filter((f) => f.slope > 0)
    .slice(0, 2)
    .forEach((f) => {
      const match = products.find((p) => p.product_name === f.product_name && isNamedSupplier(p.cheapest_supplier));
      const chez = match ? ` chez ${match.cheapest_supplier}` : '';
      advice.push(`${f.product_name} est en hausse prévue : anticipez l'achat${chez} avant le mois prochain.`);
    });

  if (!withSaving.length) {
    advice.push('Pas d’écart de prix suffisant entre fournisseurs identifiés pour proposer un rééquilibrage.');
  }

  let recommended_supplier: string | null = null;
  let predicted_savings_pct = 0;
  let recommendation: string | null = null;

  const months = [...new Set(lines.map((l) => l.month).filter(Boolean))].sort();
  const recentMonths = new Set(months.slice(-3));
  const recent = lines.filter((l) => recentMonths.has(l.month) && isNamedSupplier(l.supplier));
  const qtyByProduct = new Map<string, number>();
  const qtyByProductSupplier = new Map<string, Map<string, number>>();
  recent.forEach((l) => {
    const key = l.product_name.trim();
    qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + l.quantity);
    const inner = qtyByProductSupplier.get(key) || new Map<string, number>();
    inner.set(l.supplier, (inner.get(l.supplier) || 0) + l.quantity);
    qtyByProductSupplier.set(key, inner);
  });

  let currentCost = 0;
  let bestCost = 0;
  const savingsBySupplier = new Map<string, number>();
  for (const f of forecasts) {
    const qty = qtyByProduct.get(f.product_name) || 0;
    if (qty <= 0 || f.by_supplier.length < 2) continue;
    const usual = [...(qtyByProductSupplier.get(f.product_name) || [])].sort((a, b) => b[1] - a[1])[0]?.[0];
    const usualPred = f.by_supplier.find((s) => s.name === usual)?.predicted_price ?? f.predicted_price;
    const best = f.by_supplier[0];
    currentCost += qty * usualPred;
    bestCost += qty * best.predicted_price;
    const gain = qty * (usualPred - best.predicted_price);
    if (gain > 0) savingsBySupplier.set(best.name, (savingsBySupplier.get(best.name) || 0) + gain);
  }

  if (currentCost > 0 && bestCost < currentCost - 1) {
    predicted_savings_pct = Math.round(((currentCost - bestCost) / currentCost) * 1000) / 10;
    recommended_supplier = [...savingsBySupplier.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (recommended_supplier && predicted_savings_pct >= 1) {
      recommendation = `Acheter chez ${recommended_supplier} devrait vous faire économiser environ ${Math.round(predicted_savings_pct)} % sur votre prochaine commande.`;
    }
  }

  return {
    actual_spent: Math.round(actual_spent),
    optimized_spent: Math.round(optimized_spent),
    potential_savings: Math.round(potential_savings),
    savings_pct,
    unnamed_count,
    products,
    advice,
    recommended_supplier,
    predicted_savings_pct,
    recommendation,
  };
}
