import { supabase } from './supabase';
import { isDemoMode } from './demo/demo-mode';
import * as demo from './demo/demo-store';
import { fitLinearNext, formatMonthLong, mean, monthlyGrowthRate, nextMonthLabel, slopeToMonthlyPct } from './predict';
import { allocateTransport, invoiceLandedTotal, transportFeeOf } from './landed-cost';
import { displaySupplier, isNamedSupplier, normalizeSupplierName, UNKNOWN_SUPPLIER } from './supplier';
import { productKey } from './pricing';
import {
  countOfflineScans,
  deleteOfflineScan,
  enqueueOfflineScan,
  getOfflineScan,
  isNetworkFailure,
  isOfflineInvoiceId,
  isOfflinePhotoPath,
  listOfflineScans,
  offlinePhotoId,
  offlineRecordId,
  putOfflineScan,
  scanToInvoice,
} from './offline/queue';
import type {
  Invoice,
  InvoiceItem,
  LastPurchasePrice,
  MonthlyKpis,
  OCRRawData,
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

export async function getPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (isOfflinePhotoPath(path)) {
    const scan = await getOfflineScan(offlinePhotoId(path));
    if (!scan?.photo) return null;
    return URL.createObjectURL(scan.photo);
  }
  if (isDemoMode()) return demo.demoGetPhotoUrl(path);
  const { data } = await supabase.storage.from('invoice-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function fetchInvoices(search = '', status = '', userId = ''): Promise<Invoice[]> {
  if (isDemoMode()) return demo.demoFetchInvoices(search, status);

  let cloud: Invoice[] = [];
  try {
    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('supplier_name_raw', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    cloud = (data as Invoice[]) || [];
  } catch {
    cloud = [];
  }

  const local = userId
    ? (await listOfflineScans(userId))
        .filter((s) => s.status !== 'rejected')
        .map(scanToInvoice)
    : [];
  let merged = [...local, ...cloud];
  if (status) merged = merged.filter((i) => i.status === status);
  if (search) {
    const q = search.toLowerCase();
    merged = merged.filter((i) =>
      `${i.supplier_name_raw} ${i.notes}`.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
    );
  }
  return merged;
}

export async function fetchInvoice(id: string): Promise<Invoice | null> {
  if (isOfflineInvoiceId(id)) {
    const scan = await getOfflineScan(offlineRecordId(id));
    return scan ? scanToInvoice(scan) : null;
  }
  if (isDemoMode()) return demo.demoFetchInvoice(id);
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function saveScannedInvoice(userId: string, file: File, ocr: OCRResult): Promise<string> {
  if (isDemoMode()) return demo.demoSaveScannedInvoice(userId, file, ocr);

  const persistCloud = async (): Promise<string> => {
    const invoiceId = crypto.randomUUID();
    const { error: uploadErr } = await supabase.storage
      .from('invoice-photos')
      .upload(`${userId}/${invoiceId}.jpg`, file, { contentType: 'image/jpeg', upsert: true });
    if (uploadErr) throw uploadErr;

    const { error: invErr } = await supabase.from('invoices').insert({
      id: invoiceId,
      owner_id: userId,
      supplier_name_raw: normalizeSupplierName(ocr.supplier_name),
      invoice_date: ocr.invoice_date || null,
      total_amount: parseFloat(ocr.total_amount) || 0,
      photo_path: `${userId}/${invoiceId}.jpg`,
      status: 'pending',
      ocr_raw_data: {
        provider: ocr.provider,
        confidence: ocr.confidence,
        raw_text: ocr.raw_text,
        transport_fee: 0,
      },
      notes: ocr.confidence < 0.3 ? 'OCR faible — vérifiez les champs.' : '',
    });
    if (invErr) throw invErr;

    if (ocr.items.length > 0) {
      const rows = ocr.items.map((item) => ({
        invoice_id: invoiceId,
        product_name: item.product_name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'pièce',
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(rows);
      if (itemsErr) throw itemsErr;
    }
    return invoiceId;
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return enqueueOfflineScan(userId, file, ocr);
  }

  try {
    return await persistCloud();
  } catch (err) {
    if (isNetworkFailure(err)) return enqueueOfflineScan(userId, file, ocr);
    throw err;
  }
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
  const supplierName = normalizeSupplierName(data.supplier_name_raw);
  const transport_fee = Math.max(0, Number(data.transport_fee) || 0);
  const payload = { ...data, supplier_name_raw: supplierName, transport_fee };

  if (isOfflineInvoiceId(invoiceId)) {
    const scan = await getOfflineScan(offlineRecordId(invoiceId));
    if (!scan) throw new Error('Facture introuvable');
    await putOfflineScan({
      ...scan,
      supplier_name_raw: supplierName,
      invoice_date: data.invoice_date,
      total_amount: data.total_amount,
      transport_fee,
      notes: data.notes || 'Hors-ligne — sera envoyé dès que le réseau reviendra.',
      items: data.items.map((item, i) => ({ ...item, id: item.id || `off-${i}` })),
      status: 'validated',
    });
    return;
  }

  if (isDemoMode()) {
    demo.demoValidateInvoice(invoiceId, payload);
    return;
  }
  const { data: existing } = await supabase
    .from('invoices')
    .select('owner_id, ocr_raw_data')
    .eq('id', invoiceId)
    .single();
  if (!existing) throw new Error('Facture introuvable');

  const supplier_id = await upsertSupplierId(existing.owner_id, supplierName);

  const ocr_raw_data = {
    ...((existing.ocr_raw_data as Record<string, unknown>) || {}),
    transport_fee,
  };

  const patch: Record<string, unknown> = {
    supplier_name_raw: supplierName,
    supplier_id,
    invoice_date: data.invoice_date,
    total_amount: data.total_amount,
    transport_fee,
    ocr_raw_data,
    notes: data.notes,
    status: 'validated',
  };

  const { error } = await supabase.from('invoices').update(patch).eq('id', invoiceId);
  if (error) {
    const { transport_fee: _drop, ...rest } = patch;
    const { error: retry } = await supabase.from('invoices').update(rest).eq('id', invoiceId);
    if (retry) throw retry;
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
  await insertInvoiceItems(invoiceId, data.items);
}

/** Colonnes de prix de vente (migration 003) ; null → complétées par le trigger SQL. */
function pricingColumns(item: InvoiceItem) {
  return {
    frais_transport_attribues: item.frais_transport_attribues ?? null,
    cout_de_revient_unitaire: item.cout_de_revient_unitaire ?? null,
    prix_de_vente_conseille: item.prix_de_vente_conseille ?? null,
  };
}

async function insertInvoiceItems(invoiceId: string, items: InvoiceItem[]): Promise<void> {
  if (!items.length) return;
  const base = items.map((item) => ({
    invoice_id: invoiceId,
    product_name: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price || item.quantity * item.unit_price,
  }));
  const { error } = await supabase
    .from('invoice_items')
    .insert(base.map((row, i) => ({ ...row, ...pricingColumns(items[i]) })));
  if (!error) return;
  // Base pas encore migrée (003_selling_price.sql) : on enregistre sans les colonnes de prix.
  if (/prix_de_vente|cout_de_revient|frais_transport_attribues/i.test(error.message)) {
    const { error: retry } = await supabase.from('invoice_items').insert(base);
    if (retry) throw retry;
    return;
  }
  throw error;
}

/**
 * Dernier prix d'achat validé de chaque produit (clé = productKey), hors facture en cours.
 * Sert à l'alerte de hausse sur l'écran de validation.
 */
export async function getLastPurchasePrices(
  userId: string,
  excludeInvoiceId?: string,
): Promise<Map<string, LastPurchasePrice>> {
  const result = new Map<string, LastPurchasePrice>();
  const consider = (inv: Pick<Invoice, 'invoice_date' | 'created_at' | 'supplier_name_raw'>, item: InvoiceItem) => {
    const key = productKey(item.product_name);
    const unit_price = Number(item.unit_price);
    if (!key || !(unit_price > 0)) return;
    const date = String(inv.invoice_date || inv.created_at);
    const prev = result.get(key);
    if (!prev || date > prev.date) {
      result.set(key, { unit_price, date, supplier_name_raw: inv.supplier_name_raw });
    }
  };

  if (isDemoMode()) {
    demo
      .demoGetValidatedInvoices()
      .filter((inv) => inv.id !== excludeInvoiceId)
      .forEach((inv) => (inv.invoice_items || []).forEach((item) => consider(inv, item)));
    return result;
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_date, created_at, supplier_name_raw')
    .eq('owner_id', userId)
    .eq('status', 'validated');
  const list = (invoices || []).filter((i) => i.id !== excludeInvoiceId);
  if (!list.length) return result;

  const byId = new Map(list.map((i) => [i.id, i]));
  const { data: items } = await supabase
    .from('invoice_items')
    .select('invoice_id, product_name, unit_price')
    .in('invoice_id', [...byId.keys()]);
  (items || []).forEach((item) => {
    const inv = byId.get(item.invoice_id);
    if (inv) consider(inv as Invoice, item as InvoiceItem);
  });
  return result;
}

export async function updateInvoiceSupplier(invoiceId: string, supplierNameRaw: string): Promise<void> {
  const supplierName = normalizeSupplierName(supplierNameRaw);
  if (isOfflineInvoiceId(invoiceId)) {
    const scan = await getOfflineScan(offlineRecordId(invoiceId));
    if (!scan) throw new Error('Facture introuvable');
    await putOfflineScan({ ...scan, supplier_name_raw: supplierName });
    return;
  }
  if (isDemoMode()) {
    demo.demoUpdateInvoiceSupplier(invoiceId, supplierName);
    return;
  }
  const { data: existing } = await supabase.from('invoices').select('owner_id').eq('id', invoiceId).single();
  if (!existing) throw new Error('Facture introuvable');
  const supplier_id = await upsertSupplierId(existing.owner_id, supplierName);
  await supabase.from('invoices').update({ supplier_name_raw: supplierName, supplier_id }).eq('id', invoiceId);
}

/** Crée (ou retrouve) la fiche fournisseur et renvoie son id pour invoices.supplier_id. */
async function upsertSupplierId(ownerId: string, name: string): Promise<string | null> {
  if (!name.trim()) return null;
  const { data } = await supabase
    .from('suppliers')
    .upsert({ owner_id: ownerId, name: name.trim() }, { onConflict: 'owner_id,name' })
    .select('id')
    .single();
  return data?.id ?? null;
}

export async function getKnownSupplierNames(userId: string): Promise<string[]> {
  if (isDemoMode()) {
    const names = new Set<string>();
    demo.demoGetValidatedInvoices().forEach((inv) => {
      if (isNamedSupplier(inv.supplier_name_raw)) names.add(inv.supplier_name_raw.trim());
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
  }
  const { data } = await supabase
    .from('invoices')
    .select('supplier_name_raw')
    .eq('owner_id', userId)
    .eq('status', 'validated');
  const names = new Set<string>();
  (data || []).forEach((row) => {
    if (isNamedSupplier(row.supplier_name_raw)) names.add(String(row.supplier_name_raw).trim());
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

export async function rejectInvoice(invoiceId: string): Promise<void> {
  if (isOfflineInvoiceId(invoiceId)) {
    await deleteOfflineScan(offlineRecordId(invoiceId));
    return;
  }
  if (isDemoMode()) {
    demo.demoRejectInvoice(invoiceId);
    return;
  }
  await supabase.from('invoices').update({ status: 'rejected' }).eq('id', invoiceId);
}

export async function deleteInvoice(invoiceId: string, photoPath: string): Promise<void> {
  if (isOfflineInvoiceId(invoiceId) || isOfflinePhotoPath(photoPath)) {
    await deleteOfflineScan(offlineRecordId(invoiceId));
    return;
  }
  if (isDemoMode()) {
    demo.demoDeleteInvoice(invoiceId, photoPath);
    return;
  }
  if (photoPath) {
    await supabase.storage.from('invoice-photos').remove([photoPath]);
  }
  await supabase.from('invoices').delete().eq('id', invoiceId);
}

export async function getOfflineQueueCount(userId: string): Promise<number> {
  if (isDemoMode()) return 0;
  return countOfflineScans(userId);
}

export async function flushOfflineQueue(userId: string): Promise<{ ok: number; fail: number }> {
  if (isDemoMode()) return { ok: 0, fail: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: 0, fail: 0 };
  }

  const scans = await listOfflineScans(userId);
  let ok = 0;
  let fail = 0;

  for (const scan of scans) {
    if (scan.status === 'rejected') {
      await deleteOfflineScan(scan.id);
      continue;
    }
    try {
      const photoPath = `${userId}/${scan.id}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('invoice-photos')
        .upload(photoPath, scan.photo, { contentType: 'image/jpeg', upsert: true });
      if (uploadErr) throw uploadErr;

      const supplier_id = await upsertSupplierId(userId, scan.supplier_name_raw);

      const { error: invErr } = await supabase.from('invoices').insert({
        id: scan.id,
        owner_id: userId,
        supplier_id,
        supplier_name_raw: scan.supplier_name_raw,
        invoice_date: scan.invoice_date,
        total_amount: scan.total_amount,
        transport_fee: scan.transport_fee || 0,
        photo_path: photoPath,
        status: scan.status,
        ocr_raw_data: {
          provider: scan.ocr.provider,
          confidence: scan.ocr.confidence,
          raw_text: scan.ocr.raw_text,
          transport_fee: scan.transport_fee || 0,
        },
        notes: scan.notes.replace(/Hors-ligne[^.]*\.\s*/i, '').trim(),
      });
      if (invErr) {
        if (/duplicate|already exists|23505/i.test(invErr.message)) {
          await deleteOfflineScan(scan.id);
          ok += 1;
          continue;
        }
        if (/transport_fee/i.test(invErr.message)) {
          const retry = await supabase.from('invoices').insert({
            id: scan.id,
            owner_id: userId,
            supplier_name_raw: scan.supplier_name_raw,
            invoice_date: scan.invoice_date,
            total_amount: scan.total_amount,
            photo_path: photoPath,
            status: scan.status,
            ocr_raw_data: {
              provider: scan.ocr.provider,
              confidence: scan.ocr.confidence,
              raw_text: scan.ocr.raw_text,
              transport_fee: scan.transport_fee || 0,
            },
            notes: scan.notes.replace(/Hors-ligne[^.]*\.\s*/i, '').trim(),
          });
          if (retry.error) throw retry.error;
        } else {
          throw invErr;
        }
      }

      await insertInvoiceItems(scan.id, scan.items);

      await deleteOfflineScan(scan.id);
      ok += 1;
    } catch (err) {
      const lastError = err instanceof Error ? err.message : 'Envoi impossible';
      await putOfflineScan({ ...scan, lastError });
      fail += 1;
    }
  }

  return { ok, fail };
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getMonthlyKpis(userId: string): Promise<MonthlyKpis> {
  if (isDemoMode()) {
    const validated = demo.demoGetValidatedInvoices().filter((inv) => {
      const start = startOfMonth();
      return new Date(inv.created_at) >= start;
    });
    const total = validated.reduce((s, inv) => s + invoiceLandedTotal(inv), 0);
    return {
      total_spent: total,
      invoice_count: validated.length,
      avg_amount: validated.length ? total / validated.length : 0,
    };
  }
  const start = startOfMonth().toISOString();
  const { data } = await supabase
    .from('invoices')
    .select('total_amount, ocr_raw_data, transport_fee')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', start);

  const rows = data || [];
  const total = rows.reduce((s, r) => s + invoiceLandedTotal(r), 0);
  return {
    total_spent: total,
    invoice_count: rows.length,
    avg_amount: rows.length ? total / rows.length : 0,
  };
}

/** Dépenses (facture + transport) du jour, de la semaine (lundi → aujourd'hui) et du mois en cours. */
export async function getSpendingTotals(userId: string): Promise<SpendingTotals> {
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startDay);
  startWeek.setDate(startDay.getDate() - ((startDay.getDay() + 6) % 7));
  const startMonth = startOfMonth(now);
  const from = startWeek < startMonth ? startWeek : startMonth;

  type Row = { created_at: string; total_amount: number; transport_fee?: number | null; ocr_raw_data?: OCRRawData | null };
  let rows: Row[];
  if (isDemoMode()) {
    rows = demo.demoGetValidatedInvoices().filter((inv) => new Date(inv.created_at) >= from);
  } else {
    const { data } = await supabase
      .from('invoices')
      .select('created_at, total_amount, ocr_raw_data, transport_fee')
      .eq('owner_id', userId)
      .eq('status', 'validated')
      .gte('created_at', from.toISOString());
    rows = (data || []) as Row[];
  }

  const sumSince = (start: Date) =>
    rows.filter((r) => new Date(r.created_at) >= start).reduce((s, r) => s + invoiceLandedTotal(r), 0);
  return { day: sumSince(startDay), week: sumSince(startWeek), month: sumSince(startMonth) };
}

export async function getMonthOverMonthChange(userId: string): Promise<number> {
  if (isDemoMode()) return 12.5;
  const now = new Date();
  const startCurrent = startOfMonth(now);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const { data: current } = await supabase
    .from('invoices')
    .select('total_amount, ocr_raw_data, transport_fee')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', startCurrent.toISOString());

  const { data: previous } = await supabase
    .from('invoices')
    .select('total_amount, ocr_raw_data, transport_fee')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', startPrev.toISOString())
    .lt('created_at', startCurrent.toISOString());

  const cur = (current || []).reduce((s, r) => s + invoiceLandedTotal(r), 0);
  const prev = (previous || []).reduce((s, r) => s + invoiceLandedTotal(r), 0);
  if (prev <= 0) return cur <= 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

export async function getRecentPurchases(userId: string, limit = 5): Promise<Invoice[]> {
  if (isDemoMode()) {
    return demo.demoGetValidatedInvoices().slice(0, limit);
  }
  let cloud: Invoice[] = [];
  try {
    const { data } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('owner_id', userId)
      .eq('status', 'validated')
      .order('created_at', { ascending: false })
      .limit(limit);
    cloud = (data as Invoice[]) || [];
  } catch {
    cloud = [];
  }
  const local = (await listOfflineScans(userId))
    .filter((s) => s.status === 'validated')
    .map(scanToInvoice);
  return [...local, ...cloud]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

export async function getValidatedInvoicesForMonth(
  _userId: string,
  year: number,
  month: number,
): Promise<Invoice[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  if (isDemoMode()) {
    return demo
      .demoGetValidatedInvoices()
      .filter((inv) => invoiceMonth(inv) === ym)
      .sort((a, b) => String(b.invoice_date || b.created_at).localeCompare(String(a.invoice_date || a.created_at)));
  }
  const { data } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('owner_id', _userId)
    .eq('status', 'validated')
    .order('created_at', { ascending: false });
  return ((data as Invoice[]) || []).filter((inv) => invoiceMonth(inv) === ym);
}

export async function getTopProducts(userId: string, limit = 20): Promise<TopProduct[]> {
  if (isDemoMode()) {
    const items = demo.demoGetValidatedInvoices().flatMap((inv) => inv.invoice_items || []);
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
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'validated');

  const ids = (invoices || []).map((i) => i.id);
  if (!ids.length) return [];

  const { data: items } = await supabase.from('invoice_items').select('*').in('invoice_id', ids);

  const map = new Map<string, { qty: number; prices: number[]; count: number }>();
  (items || []).forEach((item) => {
    const key = item.product_name;
    const entry = map.get(key) || { qty: 0, prices: [], count: 0 };
    entry.qty += Number(item.quantity);
    entry.prices.push(Number(item.unit_price));
    entry.count += 1;
    map.set(key, entry);
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

export async function getPriceEvolution(
  userId: string,
  productName: string,
  months = 6,
): Promise<PriceEvolutionPoint[]> {
  if (isDemoMode()) {
    const invoices = demo.demoGetValidatedInvoices();
    const monthly: Record<string, number[]> = {};
    invoices.forEach((inv) => {
      (inv.invoice_items || []).forEach((item) => {
        if (!item.product_name.toLowerCase().includes(productName.toLowerCase())) return;
        const month = String(inv.invoice_date || inv.created_at).slice(0, 7);
        if (!monthly[month]) monthly[month] = [];
        monthly[month].push(Number(item.unit_price));
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - months * 30);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, created_at, invoice_date')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', cutoff.toISOString());

  const invMap = new Map(
    (invoices || []).map((i) => [i.id, String(i.invoice_date || i.created_at)]),
  );
  const ids = [...invMap.keys()];
  if (!ids.length) return [];

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .in('invoice_id', ids)
    .ilike('product_name', `%${productName}%`);

  const monthly: Record<string, number[]> = {};
  (items || []).forEach((item) => {
    const created = invMap.get(item.invoice_id);
    if (!created) return;
    const month = created.slice(0, 7);
    if (!monthly[month]) monthly[month] = [];
    monthly[month].push(Number(item.unit_price));
  });

  return Object.keys(monthly)
    .sort()
    .map((month) => ({
      month,
      avg_price: monthly[month].reduce((a, b) => a + b, 0) / monthly[month].length,
      count: monthly[month].length,
    }));
}

export async function getPriceAlerts(userId: string, threshold = 5): Promise<PriceAlert[]> {
  const products = await getTopProducts(userId, 50);
  const alerts: PriceAlert[] = [];

  for (const product of products) {
    const evolution = await getPriceEvolution(userId, product.product_name, 6);
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

export async function getSpendingBySupplier(userId: string, months = 3): Promise<SupplierSpending[]> {
  if (isDemoMode()) {
    const map = new Map<string, { total: number; count: number }>();
    demo.demoGetValidatedInvoices().forEach((inv) => {
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - months * 30);

  const { data } = await supabase
    .from('invoices')
    .select('supplier_name_raw, total_amount, ocr_raw_data, transport_fee')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', cutoff.toISOString());

  const map = new Map<string, { total: number; count: number }>();
  (data || []).forEach((row) => {
    const name = displaySupplier(row.supplier_name_raw);
    const entry = map.get(name) || { total: 0, count: 0 };
    entry.total += invoiceLandedTotal(row);
    entry.count += 1;
    map.set(name, entry);
  });

  return Array.from(map.entries())
    .map(([supplier_name_raw, v]) => ({
      supplier_name_raw,
      total: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);
}

export function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function invoiceMonth(inv: { invoice_date: string | null; created_at: string }): string {
  return String(inv.invoice_date || inv.created_at).slice(0, 7);
}

export async function getMonthlySpendingSeries(userId: string, months = 6): Promise<{ month: string; total: number }[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  let rows: { month: string; total: number }[] = [];
  if (isDemoMode()) {
    const map = new Map<string, number>();
    demo.demoGetValidatedInvoices().forEach((inv) => {
      const month = invoiceMonth(inv);
      map.set(month, (map.get(month) || 0) + invoiceLandedTotal(inv));
    });
    rows = [...map.entries()].map(([month, total]) => ({ month, total }));
  } else {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_date, created_at, total_amount, ocr_raw_data, transport_fee')
      .eq('owner_id', userId)
      .eq('status', 'validated')
      .gte('created_at', cutoff.toISOString());
    const map = new Map<string, number>();
    (data || []).forEach((inv) => {
      const month = invoiceMonth(inv);
      map.set(month, (map.get(month) || 0) + invoiceLandedTotal(inv));
    });
    rows = [...map.entries()].map(([month, total]) => ({ month, total }));
  }

  return rows.sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

export async function getSpendingForecast(userId: string): Promise<SpendingForecast | null> {
  const history = await getMonthlySpendingSeries(userId, 6);
  if (history.length < 2) return null;

  const last3 = history.slice(-3);
  const avg3 = mean(last3.map((h) => h.total));

  const products = await getTopProducts(userId, 15);
  const rates: number[] = [];
  for (const product of products) {
    const evo = await getPriceEvolution(userId, product.product_name, 6);
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
    summary: `En fonction de vos achats passés et de l'augmentation récente des prix (${sign}${inflation_pct} %), prévoyez environ ${formatFcfa(predicted_total)} de budget d'achat pour ${formatMonthLong(predicted_month)}.`,
  };
}

function monthlyAvgSeries(points: { month: string; price: number }[]): number[] {
  const map = new Map<string, number[]>();
  points.forEach((p) => {
    const arr = map.get(p.month) || [];
    arr.push(p.price);
    map.set(p.month, arr);
  });
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, prices]) => mean(prices));
}

function forecastFromSeries(series: number[]): {
  last: number;
  predicted: number;
  monthly_pct: number;
  slope: number;
  r2: number;
  n: number;
} | null {
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

export async function getProductPriceForecasts(userId: string, limit = 5): Promise<ProductForecast[]> {
  const products = await getTopProducts(userId, 12);
  const lines = await getValidatedPurchaseLines(userId);
  const out: ProductForecast[] = [];

  for (const product of products) {
    const evo = await getPriceEvolution(userId, product.product_name, 8);
    const overall = forecastFromSeries(evo.map((p) => p.avg_price));
    if (!overall || evo.length < 2) continue;

    const related = lines.filter(
      (l) => l.product_name.trim().toLowerCase() === product.product_name.trim().toLowerCase(),
    );
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
        return {
          name,
          last_price: f.last,
          predicted_price: f.predicted,
          monthly_pct: f.monthly_pct,
          n: f.n,
        };
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

async function getValidatedPurchaseLines(userId: string): Promise<PurchaseLine[]> {
  const toLines = (inv: Invoice): PurchaseLine[] => {
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
  };

  if (isDemoMode()) {
    return demo.demoGetValidatedInvoices().flatMap(toLines);
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, supplier_name_raw, invoice_date, created_at, total_amount, transport_fee, ocr_raw_data')
    .eq('owner_id', userId)
    .eq('status', 'validated');
  const list = invoices || [];
  if (!list.length) return [];
  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .in(
      'invoice_id',
      list.map((i) => i.id),
    );

  const byInv = new Map<string, InvoiceItem[]>();
  (items || []).forEach((item) => {
    const arr = byInv.get(item.invoice_id) || [];
    arr.push(item as InvoiceItem);
    byInv.set(item.invoice_id, arr);
  });

  return list.flatMap((row) =>
    toLines({
      ...(row as Invoice),
      invoice_items: byInv.get(row.id) || [],
    }),
  );
}

export async function getFinancialOptimization(userId: string): Promise<FinancialOptimization | null> {
  const lines = (await getValidatedPurchaseLines(userId)).filter(
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
      .map(([name, v]) => ({
        name,
        qty: v.qty,
        avg_price: v.qty > 0 ? v.spent / v.qty : 0,
      }))
      .filter((s) => s.avg_price > 0)
      .sort((a, b) => a.avg_price - b.avg_price);
    if (!suppliers.length) continue;

    const named = suppliers.filter((s) => isNamedSupplier(s.name));
    const unnamed = suppliers.find((s) => !isNamedSupplier(s.name));
    const cheapestNamed = named[0];
    const actual_spent = plist.reduce((s, l) => s + l.total_price, 0);
    const qty = plist.reduce((s, l) => s + l.quantity, 0);

    let cheapest_supplier = cheapestNamed?.name || UNKNOWN_SUPPLIER;
    let cheapest_unit_price = cheapestNamed?.avg_price || 0;
    let optimized_spent = actual_spent;
    if (cheapestNamed) {
      optimized_spent = qty * cheapestNamed.avg_price;
    }
    const savings = Math.max(0, actual_spent - optimized_spent);
    products.push({
      product_name,
      qty,
      actual_spent,
      optimized_spent,
      savings,
      cheapest_supplier,
      cheapest_unit_price,
      suppliers,
    });
    if (unnamed && cheapestNamed && unnamed.avg_price + 1 < cheapestNamed.avg_price) {
      unnamedCheaper = true;
    }
  }

  products.sort((a, b) => b.savings - a.savings);
  const actual_spent = products.reduce((s, p) => s + p.actual_spent, 0);
  const optimized_spent = products.reduce((s, p) => s + p.optimized_spent, 0);
  const potential_savings = Math.max(0, actual_spent - optimized_spent);
  const savings_pct = actual_spent > 0 ? (potential_savings / actual_spent) * 100 : 0;

  const advice: string[] = [];
  if (unnamedCheaper) {
    advice.push(
      'Certains tickets sans nom de vendeur sont moins chers que vos fournisseurs identifiés. Notez le nom du vendeur pour en faire un conseil.',
    );
  }
  const withSaving = products.filter(
    (p) => p.savings >= 1 && isNamedSupplier(p.cheapest_supplier) && p.suppliers.filter((s) => isNamedSupplier(s.name)).length >= 1,
  );
  withSaving.slice(0, 3).forEach((p) => {
    advice.push(
      `Privilégier ${p.cheapest_supplier} pour ${p.product_name} (${formatFcfa(p.cheapest_unit_price)} / unité).`,
    );
  });

  const forecasts = await getProductPriceForecasts(userId, 8);
  forecasts
    .filter((f) => f.slope > 0)
    .slice(0, 2)
    .forEach((f) => {
      const match = products.find((p) => p.product_name === f.product_name && isNamedSupplier(p.cheapest_supplier));
      const chez = match ? ` chez ${match.cheapest_supplier}` : '';
      advice.push(
        `${f.product_name} est en hausse prévue : anticiper l'achat${chez} avant le prochain mois.`,
      );
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
    if (gain > 0) {
      savingsBySupplier.set(best.name, (savingsBySupplier.get(best.name) || 0) + gain);
    }
  }

  if (currentCost > 0 && bestCost < currentCost - 1) {
    predicted_savings_pct = Math.round(((currentCost - bestCost) / currentCost) * 1000) / 10;
    recommended_supplier = [...savingsBySupplier.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (recommended_supplier && predicted_savings_pct >= 1) {
      recommendation = `Il est prédit que les achats chez ${recommended_supplier} vous feront économiser environ ${Math.round(predicted_savings_pct)} % sur votre prochaine commande globale.`;
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
