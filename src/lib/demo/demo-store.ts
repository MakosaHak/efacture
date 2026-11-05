import type { Profile, Invoice, InvoiceItem, OCRResult, ProductPrice } from '../../types/invoice';
import { DEMO_USER_ID } from './demo-mode';
import { displaySupplier, normalizeSupplierName } from '../supplier';
import { averagePurchasePrices, DEFAULT_MARGIN, suggestSellingPrice } from '../pricing';

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  nom_commerce: 'Épicerie Demo Adawlato',
  telephone: '+228 90 00 00 00',
  adresse: 'Marché Adawlato, Lomé',
  quartier: 'Adawlato',
  default_margin: DEFAULT_MARGIN,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Image placeholder (SVG vert) pour les vignettes démo */
export function demoPlaceholderPhoto(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect fill="#1E3A8A" width="400" height="300"/>
    <text x="200" y="140" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18" font-weight="bold">E-Facture</text>
    <text x="200" y="170" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="14">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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

function makeInvoice(
  id: string,
  supplier: string,
  iso: string,
  items: InvoiceItem[],
  status: Invoice['status'] = 'validated',
  notes = '',
  transport_fee = 0,
): Invoice {
  const total = items.reduce((s, it) => s + Number(it.total_price), 0);
  return {
    id,
    owner_id: DEMO_USER_ID,
    supplier_id: null,
    supplier_name_raw: supplier,
    invoice_date: iso.slice(0, 10),
    total_amount: total,
    transport_fee,
    photo_path: `demo:${id}`,
    status,
    ocr_raw_data: { provider: 'tesseract.js', confidence: 0.8, raw_text: 'Demo', transport_fee },
    notes,
    created_at: iso,
    updated_at: iso,
    invoice_items: items,
  };
}

function line(id: string, product_name: string, quantity: number, unit: string, unit_price: number): InvoiceItem {
  return {
    id,
    product_name,
    quantity,
    unit,
    unit_price,
    total_price: quantity * unit_price,
  };
}

function buildSeedInvoices(): Invoice[] {
  const may = monthsAgo(3);
  const june = monthsAgo(2);
  const july = monthsAgo(1);
  const augA = daysAgo(8);
  const augB = daysAgo(5);

  return [
    makeInvoice('demo-may-a', 'Grossiste Adawlato', may, [
      line('m-a-riz', 'Sac de Riz 50kg', 5, 'sac', 22000),
      line('m-a-huile', 'Huile végétale 5L', 10, 'bidon', 4500),
      line('m-a-ciment', 'Ciment 50kg', 4, 'sac', 5500),
    ], 'validated', '', 3000),
    makeInvoice('demo-jun-a', 'Grossiste Adawlato', june, [
      line('j-a-riz', 'Sac de Riz 50kg', 4, 'sac', 22440),
      line('j-a-huile', 'Huile végétale 5L', 6, 'bidon', 4590),
      line('j-a-ciment', 'Ciment 50kg', 3, 'sac', 5610),
    ], 'validated', '', 2500),
    makeInvoice('demo-jun-b', 'Assivito Market', june, [
      line('j-b-riz', 'Sac de Riz 50kg', 2, 'sac', 21000),
      line('j-b-huile', 'Huile végétale 5L', 4, 'bidon', 4300),
      line('j-b-ciment', 'Ciment 50kg', 2, 'sac', 5200),
    ], 'validated', '', 1500),
    makeInvoice('demo-jul-a', 'Grossiste Adawlato', july, [
      line('jl-a-riz', 'Sac de Riz 50kg', 4, 'sac', 23113),
      line('jl-a-huile', 'Huile végétale 5L', 6, 'bidon', 4728),
      line('jl-a-ciment', 'Ciment 50kg', 3, 'sac', 5722),
    ], 'validated', '', 2500),
    makeInvoice('demo-jul-b', 'Assivito Market', july, [
      line('jl-b-riz', 'Sac de Riz 50kg', 2, 'sac', 21100),
      line('jl-b-huile', 'Huile végétale 5L', 4, 'bidon', 4320),
      line('jl-b-ciment', 'Ciment 50kg', 2, 'sac', 5220),
    ], 'validated', '', 1500),
    makeInvoice('demo-aug-a', 'Grossiste Adawlato', augA, [
      line('a-a-riz', 'Sac de Riz 50kg', 4, 'sac', 23806),
      line('a-a-huile', 'Huile végétale 5L', 6, 'bidon', 4870),
      line('a-a-ciment', 'Ciment 50kg', 3, 'sac', 5836),
    ], 'validated', '', 2000),
    makeInvoice('demo-aug-b', 'Assivito Market', augB, [
      line('a-b-riz', 'Sac de Riz 50kg', 2, 'sac', 21150),
      line('a-b-huile', 'Huile végétale 5L', 4, 'bidon', 4330),
      line('a-b-ciment', 'Ciment 50kg', 2, 'sac', 5230),
    ], 'validated', '', 1500),
    makeInvoice(
      'demo-inv-anon',
      '',
      daysAgo(3),
      [line('i-anon', 'Farine de blé 1kg', 5, 'sachet', 900)],
      'validated',
      'Nom du vendeur absent sur le ticket — à compléter si vous le connaissez.',
    ),
    makeInvoice(
      'demo-inv-3',
      'Fournisseur Tokoin',
      daysAgo(0),
      [line('i4', 'Article détecté (à compléter)', 1, 'pièce', 12000)],
      'pending',
      'OCR faible — vérifiez les champs.',
    ),
  ];
}

const photoUrls = new Map<string, string>();

export function initDemoPhotos(): void {
  const labels: Record<string, string> = {
    'demo:demo-may-a': 'Adawlato mai',
    'demo:demo-jun-a': 'Adawlato juin',
    'demo:demo-jun-b': 'Assivito juin',
    'demo:demo-jul-a': 'Adawlato juillet',
    'demo:demo-jul-b': 'Assivito juillet',
    'demo:demo-aug-a': 'Adawlato août',
    'demo:demo-aug-b': 'Assivito août',
    'demo:demo-inv-anon': 'Sans fournisseur',
    'demo:demo-inv-3': 'En attente',
  };
  Object.entries(labels).forEach(([path, label]) => {
    photoUrls.set(path, demoPlaceholderPhoto(label));
  });
}

let invoices: Invoice[] = buildSeedInvoices();
initDemoPhotos();

/* ---------- Prix de vente (product_prices local) ---------- */

/** Marges déjà apprises dans le jeu démo (produits vendus depuis plusieurs mois). */
const SEED_MARGINS: Record<string, number> = {
  'sac de riz 50 kg': 0.12,
  'huile vegetale 5 l': 0.18,
  'ciment 50 kg': 0.1,
  'farine de ble 1 kg': 0.25,
};

let defaultMargin = DEFAULT_MARGIN;
let productPrices = new Map<string, ProductPrice>();

/** Construit les prix confirmés à partir de l'historique des factures validées du jeu démo. */
function buildSeedProductPrices(source: Invoice[]): Map<string, ProductPrice> {
  const map = new Map<string, ProductPrice>();
  [...source]
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
  return map;
}

productPrices = buildSeedProductPrices(invoices);

export function demoGetDefaultMargin(): number {
  return defaultMargin;
}

export function demoSetDefaultMargin(value: number): void {
  defaultMargin = value;
}

export function demoGetProductPrice(productKey: string): ProductPrice | null {
  return productPrices.get(productKey) ?? null;
}

export function demoSaveProductPrice(row: ProductPrice): void {
  productPrices.set(row.product_key, { ...row });
}

export function demoListProductPrices(): ProductPrice[] {
  return [...productPrices.values()].map((r) => ({ ...r }));
}

export function resetDemoStore(): void {
  invoices = buildSeedInvoices();
  defaultMargin = DEFAULT_MARGIN;
  productPrices = buildSeedProductPrices(invoices);
  photoUrls.clear();
  initDemoPhotos();
}

export function demoGetPhotoUrl(path: string): string | null {
  if (!path) return null;
  return photoUrls.get(path) ?? demoPlaceholderPhoto('Facture');
}

export function demoFetchInvoices(search = '', status = ''): Invoice[] {
  let list = [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (status) list = list.filter((i) => i.status === status);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((i) => displaySupplier(i.supplier_name_raw).toLowerCase().includes(q));
  }
  return list.map((inv) => ({ ...inv, invoice_items: [...(inv.invoice_items || [])] }));
}

export function demoFetchInvoice(id: string): Invoice | null {
  const inv = invoices.find((i) => i.id === id);
  return inv ? { ...inv, invoice_items: [...(inv.invoice_items || [])] } : null;
}

export function demoSaveScannedInvoice(_userId: string, file: File, ocr: OCRResult): string {
  const invoiceId = `demo-inv-${Date.now()}`;
  const photoPath = `demo:${invoiceId}`;
  photoUrls.set(photoPath, URL.createObjectURL(file));

  const items: InvoiceItem[] = ocr.items.map((item, idx) => ({
    id: `new-${idx}`,
    product_name: item.product_name,
    quantity: parseFloat(item.quantity) || 1,
    unit: item.unit || 'pièce',
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0,
  }));

  const inv: Invoice = {
    id: invoiceId,
    owner_id: DEMO_USER_ID,
    supplier_id: null,
    supplier_name_raw: normalizeSupplierName(ocr.supplier_name),
    invoice_date: ocr.invoice_date || null,
    total_amount: parseFloat(ocr.total_amount) || 0,
    transport_fee: 0,
    photo_path: photoPath,
    status: 'pending',
    ocr_raw_data: { provider: ocr.provider, confidence: ocr.confidence, raw_text: ocr.raw_text },
    notes: ocr.confidence < 0.3 ? 'OCR faible — vérifiez les champs.' : '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    invoice_items: items,
  };

  invoices.unshift(inv);
  return invoiceId;
}

export function demoValidateInvoice(
  invoiceId: string,
  data: {
    supplier_name_raw: string;
    invoice_date: string | null;
    total_amount: number;
    transport_fee?: number;
    notes: string;
    items: InvoiceItem[];
  },
): void {
  const idx = invoices.findIndex((i) => i.id === invoiceId);
  if (idx < 0) throw new Error('Facture introuvable');
  invoices[idx] = {
    ...invoices[idx],
    supplier_name_raw: data.supplier_name_raw,
    invoice_date: data.invoice_date,
    total_amount: data.total_amount,
    transport_fee: data.transport_fee || 0,
    ocr_raw_data: { ...invoices[idx].ocr_raw_data, transport_fee: data.transport_fee || 0 },
    notes: data.notes,
    status: 'validated',
    updated_at: new Date().toISOString(),
    invoice_items: data.items.map((item, i) => ({ ...item, id: item.id || `v-${i}` })),
  };
}

export function demoUpdateInvoiceSupplier(invoiceId: string, supplierName: string): void {
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error('Facture introuvable');
  inv.supplier_name_raw = supplierName;
  inv.updated_at = new Date().toISOString();
}

export function demoRejectInvoice(invoiceId: string): void {
  const inv = invoices.find((i) => i.id === invoiceId);
  if (inv) inv.status = 'rejected';
}

export function demoDeleteInvoice(invoiceId: string, photoPath: string): void {
  if (photoPath?.startsWith('demo:')) {
    const url = photoUrls.get(photoPath);
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    photoUrls.delete(photoPath);
  }
  invoices = invoices.filter((i) => i.id !== invoiceId);
}

export function demoGetValidatedInvoices(): Invoice[] {
  return invoices.filter((i) => i.status === 'validated');
}
