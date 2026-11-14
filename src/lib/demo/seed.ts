/**
 * Jeu de données d'exemple pour le compte de démonstration. Inséré une seule
 * fois dans la base locale ; ensuite les modifications sont conservées comme
 * pour n'importe quel compte.
 */
import type { Invoice, InvoiceItem, ProductPrice } from '../../types/invoice';
import { averagePurchasePrices, DEFAULT_MARGIN, suggestSellingPrice } from '../pricing';
import { listInvoices, putInvoices, putPhoto, putProductPrices, putSetting } from '../db/repo';

function placeholderPhoto(label: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="#F3F4F6"/>
    <rect x="60" y="60" width="480" height="680" rx="12" fill="#FFFFFF" stroke="#E5E7EB"/>
    <text x="300" y="150" text-anchor="middle" fill="#111827" font-family="sans-serif" font-size="28" font-weight="600">${label}</text>
    <text x="300" y="190" text-anchor="middle" fill="#6B7280" font-family="sans-serif" font-size="16">Reçu d'exemple</text>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="100" y="${260 + i * 60}" width="${260 + (i % 3) * 40}" height="14" rx="7" fill="#E5E7EB"/><rect x="420" y="${260 + i * 60}" width="80" height="14" rx="7" fill="#D1D5DB"/>`).join('')}
    <rect x="100" y="660" width="400" height="2" fill="#D1D5DB"/>
    <text x="500" y="705" text-anchor="end" fill="#111827" font-family="sans-serif" font-size="22" font-weight="700">TOTAL</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(months: number, day = 12): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(day);
  return d.toISOString();
}

function line(id: string, product_name: string, quantity: number, unit: string, unit_price: number): InvoiceItem {
  return { id, product_name, quantity, unit, unit_price, total_price: quantity * unit_price };
}

interface SeedSpec {
  id: string;
  supplier: string;
  iso: string;
  items: InvoiceItem[];
  status?: Invoice['status'];
  notes?: string;
  transport_fee?: number;
  label: string;
}

function specs(): SeedSpec[] {
  return [
    { id: 'demo-m3-a', supplier: 'Grossiste Adawlato', iso: monthsAgo(3), transport_fee: 3000, label: 'Adawlato', items: [
      line('m3-a-1', 'Sac de Riz 50kg', 5, 'sac', 22000),
      line('m3-a-2', 'Huile végétale 5L', 10, 'bidon', 4500),
      line('m3-a-3', 'Ciment 50kg', 4, 'sac', 5500),
    ] },
    { id: 'demo-m2-a', supplier: 'Grossiste Adawlato', iso: monthsAgo(2), transport_fee: 2500, label: 'Adawlato', items: [
      line('m2-a-1', 'Sac de Riz 50kg', 4, 'sac', 22440),
      line('m2-a-2', 'Huile végétale 5L', 6, 'bidon', 4590),
      line('m2-a-3', 'Ciment 50kg', 3, 'sac', 5610),
    ] },
    { id: 'demo-m2-b', supplier: 'Assivito Market', iso: monthsAgo(2, 20), transport_fee: 1500, label: 'Assivito', items: [
      line('m2-b-1', 'Sac de Riz 50kg', 2, 'sac', 21000),
      line('m2-b-2', 'Huile végétale 5L', 4, 'bidon', 4300),
      line('m2-b-3', 'Ciment 50kg', 2, 'sac', 5200),
    ] },
    { id: 'demo-m1-a', supplier: 'Grossiste Adawlato', iso: monthsAgo(1), transport_fee: 2500, label: 'Adawlato', items: [
      line('m1-a-1', 'Sac de Riz 50kg', 4, 'sac', 23113),
      line('m1-a-2', 'Huile végétale 5L', 6, 'bidon', 4728),
      line('m1-a-3', 'Ciment 50kg', 3, 'sac', 5722),
    ] },
    { id: 'demo-m1-b', supplier: 'Assivito Market', iso: monthsAgo(1, 22), transport_fee: 1500, label: 'Assivito', items: [
      line('m1-b-1', 'Sac de Riz 50kg', 2, 'sac', 21100),
      line('m1-b-2', 'Huile végétale 5L', 4, 'bidon', 4320),
      line('m1-b-3', 'Ciment 50kg', 2, 'sac', 5220),
    ] },
    { id: 'demo-d8', supplier: 'Grossiste Adawlato', iso: daysAgo(8), transport_fee: 2000, label: 'Adawlato', items: [
      line('d8-1', 'Sac de Riz 50kg', 4, 'sac', 23806),
      line('d8-2', 'Huile végétale 5L', 6, 'bidon', 4870),
      line('d8-3', 'Ciment 50kg', 3, 'sac', 5836),
    ] },
    { id: 'demo-d5', supplier: 'Assivito Market', iso: daysAgo(5), transport_fee: 1500, label: 'Assivito', items: [
      line('d5-1', 'Sac de Riz 50kg', 2, 'sac', 21150),
      line('d5-2', 'Huile végétale 5L', 4, 'bidon', 4330),
      line('d5-3', 'Ciment 50kg', 2, 'sac', 5230),
    ] },
    { id: 'demo-d3', supplier: '', iso: daysAgo(3), label: 'Sans nom', notes: 'Nom du vendeur absent sur le ticket.', items: [
      line('d3-1', 'Farine de blé 1kg', 5, 'sachet', 900),
    ] },
    { id: 'demo-d0', supplier: 'Fournisseur Tokoin', iso: daysAgo(0), status: 'pending', label: 'Tokoin', notes: 'Lecture incertaine, vérifiez les champs.', items: [
      line('d0-1', 'Article détecté (à compléter)', 1, 'pièce', 12000),
    ] },
  ];
}

const SEED_MARGINS: Record<string, number> = {
  'sac de riz 50 kg': 0.12,
  'huile vegetale 5 l': 0.18,
  'ciment 50 kg': 0.1,
  'farine de ble 1 kg': 0.25,
};

function buildPrices(invoices: Invoice[]): ProductPrice[] {
  const map = new Map<string, ProductPrice>();
  [...invoices]
    .filter((inv) => inv.status === 'validated')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((inv) => {
      averagePurchasePrices(inv.invoice_items || []).forEach((p) => {
        const prev = map.get(p.product_key);
        const margin = SEED_MARGINS[p.product_key] ?? DEFAULT_MARGIN;
        const price = suggestSellingPrice(p.unit_price, margin);
        map.set(p.product_key, {
          product_key: p.product_key,
          product_name: p.product_name,
          margin,
          last_purchase_price: p.unit_price,
          previous_purchase_price: prev?.last_purchase_price ?? null,
          suggested_price: price,
          selling_price: price,
          status: 'confirmed',
          confirmations: (prev?.confirmations ?? 0) + 1,
          updated_at: inv.created_at,
        });
      });
    });
  return [...map.values()];
}

/** Insère le jeu d'exemple pour `ownerId` si ce compte n'a encore aucune facture. */
export async function seedDemoData(ownerId: string): Promise<boolean> {
  const existing = await listInvoices(ownerId);
  if (existing.length) return false;

  const invoices: Invoice[] = [];
  for (const s of specs()) {
    const photo_path = await putPhoto(`${ownerId}-${s.id}`, placeholderPhoto(s.label));
    const total = s.items.reduce((sum, it) => sum + Number(it.total_price), 0);
    invoices.push({
      id: s.id,
      owner_id: ownerId,
      supplier_id: null,
      supplier_name_raw: s.supplier,
      invoice_date: s.iso.slice(0, 10),
      total_amount: total,
      transport_fee: s.transport_fee || 0,
      photo_path,
      status: s.status ?? 'validated',
      ocr_raw_data: { provider: 'exemple', confidence: 0.8, raw_text: '', transport_fee: s.transport_fee || 0 },
      notes: s.notes || '',
      created_at: s.iso,
      updated_at: s.iso,
      invoice_items: s.items,
    });
  }
  await putInvoices(invoices);
  await putProductPrices(ownerId, buildPrices(invoices));
  await putSetting(ownerId, 'default_margin', DEFAULT_MARGIN);
  return true;
}
