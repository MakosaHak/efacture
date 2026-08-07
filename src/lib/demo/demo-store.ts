import type { Profile, Invoice, InvoiceItem, OCRResult } from '../../types/invoice';
import { DEMO_USER_ID } from './demo-mode';

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  nom_commerce: 'Épicerie Demo Adawlato',
  telephone: '+228 90 00 00 00',
  adresse: 'Marché Adawlato, Lomé',
  quartier: 'Adawlato',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Image placeholder (SVG vert) pour les vignettes démo */
export function demoPlaceholderPhoto(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect fill="#006d41" width="400" height="300"/>
    <text x="200" y="140" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18" font-weight="bold">E-Facture</text>
    <text x="200" y="170" text-anchor="middle" fill="#e8f5ee" font-family="sans-serif" font-size="14">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function buildSeedInvoices(): Invoice[] {
  const items1: InvoiceItem[] = [
    { id: 'i1', product_name: 'Riz parfumé 25kg', quantity: 2, unit: 'sac', unit_price: 12500, total_price: 25000 },
    { id: 'i2', product_name: 'Huile végétale 1L', quantity: 10, unit: 'bouteille', unit_price: 850, total_price: 8500 },
  ];
  const items2: InvoiceItem[] = [
    { id: 'i3', product_name: 'Sucre en poudre 1kg', quantity: 5, unit: 'sachet', unit_price: 750, total_price: 3750 },
  ];

  return [
    {
      id: 'demo-inv-1',
      owner_id: DEMO_USER_ID,
      supplier_id: null,
      supplier_name_raw: 'Grossiste Adawlato',
      invoice_date: daysAgo(2).slice(0, 10),
      total_amount: 33500,
      photo_path: 'demo:inv-1',
      status: 'validated',
      ocr_raw_data: { provider: 'tesseract.js', confidence: 0.82, raw_text: 'Demo' },
      notes: '',
      created_at: daysAgo(2),
      updated_at: daysAgo(2),
      invoice_items: items1,
    },
    {
      id: 'demo-inv-2',
      owner_id: DEMO_USER_ID,
      supplier_id: null,
      supplier_name_raw: 'Assivito Market',
      invoice_date: daysAgo(5).slice(0, 10),
      total_amount: 18750,
      photo_path: 'demo:inv-2',
      status: 'validated',
      ocr_raw_data: { provider: 'tesseract.js', confidence: 0.78 },
      notes: '',
      created_at: daysAgo(5),
      updated_at: daysAgo(5),
      invoice_items: items2,
    },
    {
      id: 'demo-inv-3',
      owner_id: DEMO_USER_ID,
      supplier_id: null,
      supplier_name_raw: 'Fournisseur Tokoin',
      invoice_date: null,
      total_amount: 12000,
      photo_path: 'demo:inv-3',
      status: 'pending',
      ocr_raw_data: { provider: 'tesseract.js', confidence: 0.45, raw_text: '' },
      notes: 'OCR faible — vérifiez les champs.',
      created_at: daysAgo(0),
      updated_at: daysAgo(0),
      invoice_items: [
        { id: 'i4', product_name: 'Article détecté (à compléter)', quantity: 1, unit: 'pièce', unit_price: 12000, total_price: 12000 },
      ],
    },
  ];
}

const photoUrls = new Map<string, string>();

export function initDemoPhotos(): void {
  photoUrls.set('demo:inv-1', demoPlaceholderPhoto('Adawlato'));
  photoUrls.set('demo:inv-2', demoPlaceholderPhoto('Assivito'));
  photoUrls.set('demo:inv-3', demoPlaceholderPhoto('En attente'));
}

let invoices: Invoice[] = buildSeedInvoices();
initDemoPhotos();

export function resetDemoStore(): void {
  invoices = buildSeedInvoices();
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
    list = list.filter((i) => i.supplier_name_raw.toLowerCase().includes(q));
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
    supplier_name_raw: ocr.supplier_name,
    invoice_date: ocr.invoice_date || null,
    total_amount: parseFloat(ocr.total_amount) || 0,
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
    notes: data.notes,
    status: 'validated',
    updated_at: new Date().toISOString(),
    invoice_items: data.items.map((item, i) => ({ ...item, id: item.id || `v-${i}` })),
  };
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
