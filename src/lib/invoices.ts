import { supabase } from './supabase';
import { isDemoMode } from './demo/demo-mode';
import * as demo from './demo/demo-store';
import type {
  Invoice,
  InvoiceItem,
  MonthlyKpis,
  OCRResult,
  PriceAlert,
  PriceEvolutionPoint,
  SupplierSpending,
  TopProduct,
} from '../types/invoice';

export async function getPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (isDemoMode()) return demo.demoGetPhotoUrl(path);
  const { data } = await supabase.storage.from('invoice-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function fetchInvoices(search = '', status = ''): Promise<Invoice[]> {
  if (isDemoMode()) return demo.demoFetchInvoices(search, status);
  let query = supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('supplier_name_raw', `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Invoice[]) || [];
}

export async function fetchInvoice(id: string): Promise<Invoice | null> {
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
  const invoiceId = crypto.randomUUID();

  const { error: uploadErr } = await supabase.storage
    .from('invoice-photos')
    .upload(`${userId}/${invoiceId}.jpg`, file, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) throw uploadErr;

  const { error: invErr } = await supabase.from('invoices').insert({
    id: invoiceId,
    owner_id: userId,
    supplier_name_raw: ocr.supplier_name,
    invoice_date: ocr.invoice_date || null,
    total_amount: parseFloat(ocr.total_amount) || 0,
    photo_path: `${userId}/${invoiceId}.jpg`,
    status: 'pending',
    ocr_raw_data: {
      provider: ocr.provider,
      confidence: ocr.confidence,
      raw_text: ocr.raw_text,
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
}

export async function validateInvoice(
  invoiceId: string,
  data: {
    supplier_name_raw: string;
    invoice_date: string | null;
    total_amount: number;
    notes: string;
    items: InvoiceItem[];
  },
): Promise<void> {
  if (isDemoMode()) {
    demo.demoValidateInvoice(invoiceId, data);
    return;
  }
  const { data: existing } = await supabase.from('invoices').select('owner_id').eq('id', invoiceId).single();
  if (!existing) throw new Error('Facture introuvable');

  if (data.supplier_name_raw.trim()) {
    await supabase.from('suppliers').upsert(
      {
        owner_id: existing.owner_id,
        name: data.supplier_name_raw.trim(),
      },
      { onConflict: 'owner_id,name' },
    );
  }

  await supabase
    .from('invoices')
    .update({
      supplier_name_raw: data.supplier_name_raw,
      invoice_date: data.invoice_date,
      total_amount: data.total_amount,
      notes: data.notes,
      status: 'validated',
    })
    .eq('id', invoiceId);

  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

  if (data.items.length > 0) {
    const rows = data.items.map((item) => ({
      invoice_id: invoiceId,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price || item.quantity * item.unit_price,
    }));
    await supabase.from('invoice_items').insert(rows);
  }
}

export async function rejectInvoice(invoiceId: string): Promise<void> {
  if (isDemoMode()) {
    demo.demoRejectInvoice(invoiceId);
    return;
  }
  await supabase.from('invoices').update({ status: 'rejected' }).eq('id', invoiceId);
}

export async function deleteInvoice(invoiceId: string, photoPath: string): Promise<void> {
  if (isDemoMode()) {
    demo.demoDeleteInvoice(invoiceId, photoPath);
    return;
  }
  if (photoPath) {
    await supabase.storage.from('invoice-photos').remove([photoPath]);
  }
  await supabase.from('invoices').delete().eq('id', invoiceId);
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
    const total = validated.reduce((s, inv) => s + Number(inv.total_amount), 0);
    return {
      total_spent: total,
      invoice_count: validated.length,
      avg_amount: validated.length ? total / validated.length : 0,
    };
  }
  const start = startOfMonth().toISOString();
  const { data } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', start);

  const rows = data || [];
  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  return {
    total_spent: total,
    invoice_count: rows.length,
    avg_amount: rows.length ? total / rows.length : 0,
  };
}

export async function getMonthOverMonthChange(userId: string): Promise<number> {
  if (isDemoMode()) return 12.5;
  const now = new Date();
  const startCurrent = startOfMonth(now);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const { data: current } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', startCurrent.toISOString());

  const { data: previous } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', startPrev.toISOString())
    .lt('created_at', startCurrent.toISOString());

  const cur = (current || []).reduce((s, r) => s + Number(r.total_amount), 0);
  const prev = (previous || []).reduce((s, r) => s + Number(r.total_amount), 0);
  if (prev <= 0) return cur <= 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

export async function getRecentPurchases(userId: string, limit = 5): Promise<Invoice[]> {
  if (isDemoMode()) {
    return demo.demoGetValidatedInvoices().slice(0, limit);
  }
  const { data } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Invoice[]) || [];
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
    const now = new Date();
    return [
      { month: `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`, avg_price: 850, count: 2 },
      { month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, avg_price: 980, count: 3 },
    ].filter((_, i) => i < months + 1);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - months * 30);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, created_at')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', cutoff.toISOString());

  const invMap = new Map((invoices || []).map((i) => [i.id, i.created_at]));
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
    const month = String(created).slice(0, 7);
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

export async function getPriceAlerts(userId: string, threshold = 10): Promise<PriceAlert[]> {
  if (isDemoMode()) {
    return [{ product_name: 'Riz parfumé 25kg', first_price: 12000, last_price: 12500, change_pct: 15.2 }];
  }
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
      const name = inv.supplier_name_raw || 'Sans fournisseur';
      const e = map.get(name) || { total: 0, count: 0 };
      e.total += Number(inv.total_amount);
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
    .select('supplier_name_raw, total_amount')
    .eq('owner_id', userId)
    .eq('status', 'validated')
    .gte('created_at', cutoff.toISOString());

  const map = new Map<string, { total: number; count: number }>();
  (data || []).forEach((row) => {
    const name = row.supplier_name_raw || 'Sans fournisseur';
    const entry = map.get(name) || { total: 0, count: 0 };
    entry.total += Number(row.total_amount);
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
