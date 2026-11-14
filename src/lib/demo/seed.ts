/**
 * Jeu de données du compte d'exemple « Chez Afi » : quatre mois d'achats
 * réalistes pour une alimentation générale d'Assivito (Lomé). Inséré une
 * seule fois ; ensuite les modifications sont conservées comme pour tout compte.
 */
import type { Invoice, InvoiceItem, ProductPrice } from '../../types/invoice';
import { averagePurchasePrices, DEFAULT_MARGIN, suggestSellingPrice } from '../pricing';
import { listInvoices, putInvoices, putPhoto, putProductPrices, putSetting } from '../db/repo';
import { updateUserProfile } from '../auth/local-auth';

/* ------------------------------------------------------------------ */
/* Images d'exemple (SVG) : reçu et photo de profil                    */
/* ------------------------------------------------------------------ */

function receiptImage(supplier: string, dateLabel: string, items: InvoiceItem[], total: number): Blob {
  const rows = items
    .map(
      (it, i) => `
      <text x="70" y="${330 + i * 54}" font-family="Courier New, monospace" font-size="24" fill="#1f2937">${esc(it.product_name).slice(0, 22)}</text>
      <text x="400" y="${330 + i * 54}" font-family="Courier New, monospace" font-size="24" fill="#1f2937" text-anchor="end">${it.quantity}</text>
      <text x="530" y="${330 + i * 54}" font-family="Courier New, monospace" font-size="24" fill="#1f2937" text-anchor="end">${fmt(it.total_price)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="860" viewBox="0 0 600 860">
    <rect width="600" height="860" fill="#e9ebee"/>
    <rect x="40" y="40" width="520" height="780" fill="#fffdf7" stroke="#d6d3cd"/>
    <text x="300" y="110" text-anchor="middle" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#111827">${esc(supplier || 'RECU').toUpperCase()}</text>
    <text x="300" y="150" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#4b5563">LOME - TOGO</text>
    <text x="300" y="185" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#4b5563">${esc(dateLabel)}</text>
    <line x1="70" y1="230" x2="530" y2="230" stroke="#9ca3af" stroke-dasharray="6 6"/>
    <text x="70" y="275" font-family="Courier New, monospace" font-size="20" fill="#6b7280">ARTICLE</text>
    <text x="400" y="275" font-family="Courier New, monospace" font-size="20" fill="#6b7280" text-anchor="end">QTE</text>
    <text x="530" y="275" font-family="Courier New, monospace" font-size="20" fill="#6b7280" text-anchor="end">MONTANT</text>
    ${rows}
    <line x1="70" y1="${340 + items.length * 54}" x2="530" y2="${340 + items.length * 54}" stroke="#9ca3af" stroke-dasharray="6 6"/>
    <text x="70" y="${395 + items.length * 54}" font-family="Courier New, monospace" font-size="28" font-weight="700" fill="#111827">TOTAL</text>
    <text x="530" y="${395 + items.length * 54}" font-family="Courier New, monospace" font-size="28" font-weight="700" fill="#111827" text-anchor="end">${fmt(total)} F</text>
    <text x="300" y="790" text-anchor="middle" font-family="Courier New, monospace" font-size="18" fill="#6b7280">MERCI DE VOTRE VISITE</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** Portrait illustré (remplaçable par une vraie photo depuis la page Compte). */
function avatarImage(): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      <rect width="512" height="512" fill="#f4d7c4"/>
      <circle cx="256" cy="560" r="230" fill="#2563eb"/>
      <rect x="150" y="300" width="212" height="120" rx="60" fill="#2563eb"/>
      <circle cx="256" cy="228" r="96" fill="#7a4a2a"/>
      <path d="M150 230c0-80 50-130 106-130s106 50 106 130c0-30-20-70-106-70s-106 40-106 70z" fill="#c2410c"/>
      <path d="M160 190c20-60 60-95 96-95s76 35 96 95c-30-20-60-28-96-28s-66 8-96 28z" fill="#ea580c"/>
      <circle cx="222" cy="236" r="9" fill="#1f1310"/>
      <circle cx="290" cy="236" r="9" fill="#1f1310"/>
      <path d="M226 282q30 24 60 0" stroke="#1f1310" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="176" cy="250" r="12" fill="#fbbf24"/>
      <circle cx="336" cy="250" r="12" fill="#fbbf24"/>
    </g>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
}

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

function at(monthsBack: number, day: number, hour = 10): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack, Math.min(day, 28));
  d.setHours(hour, 15, 0, 0);
  if (d > new Date()) d.setTime(Date.now() - 3600_000);
  return d.toISOString();
}

function line(product_name: string, quantity: number, unit: string, unit_price: number): InvoiceItem {
  return { product_name, quantity, unit, unit_price, total_price: quantity * unit_price };
}

interface Spec {
  supplier: string;
  iso: string;
  items: InvoiceItem[];
  status?: Invoice['status'];
  notes?: string;
  transport_fee?: number;
}

const ADAWLATO = 'Grossiste Adawlato';
const ASSIVITO = 'Assivito Market';
const AKODESSEWA = 'Dépôt Akodessewa';
const HEDZRANAWOE = 'Grossiste Hédzranawoé';

function specs(): Spec[] {
  return [
    // Il y a 3 mois
    { supplier: ADAWLATO, iso: at(3, 4), transport_fee: 3000, items: [
      line('Sac de riz 25kg', 6, 'sac', 11800), line('Huile végétale 5L', 8, 'bidon', 4400), line('Sucre en poudre 1kg', 30, 'paquet', 620), line('Tomate concentrée 400g', 24, 'boîte', 650),
    ] },
    { supplier: ASSIVITO, iso: at(3, 12), transport_fee: 1000, items: [
      line('Savon de ménage 400g', 48, 'pièce', 325), line('Spaghetti 500g', 40, 'paquet', 425), line('Cube Maggi (boîte de 100)', 4, 'boîte', 2900),
    ] },
    { supplier: AKODESSEWA, iso: at(3, 21), transport_fee: 2000, items: [
      line('Lait en poudre 400g', 24, 'boîte', 2150), line('Sardines 125g', 50, 'boîte', 450), line('Eau minérale 1,5L', 12, 'pack de 6', 1500),
    ] },
    // Il y a 2 mois
    { supplier: ADAWLATO, iso: at(2, 3), transport_fee: 3000, items: [
      line('Sac de riz 25kg', 6, 'sac', 12100), line('Huile végétale 5L', 8, 'bidon', 4500), line('Sucre en poudre 1kg', 30, 'paquet', 630), line('Farine de blé 1kg', 20, 'sachet', 900),
    ] },
    { supplier: HEDZRANAWOE, iso: at(2, 9), transport_fee: 2500, items: [
      line('Tomate concentrée 400g', 48, 'boîte', 615), line('Spaghetti 500g', 60, 'paquet', 410), line('Sardines 125g', 50, 'boîte', 440),
    ] },
    { supplier: ASSIVITO, iso: at(2, 17), transport_fee: 1000, items: [
      line('Savon de ménage 400g', 48, 'pièce', 330), line('Cube Maggi (boîte de 100)', 4, 'boîte', 2950), line('Bougies (paquet de 6)', 20, 'paquet', 700),
    ] },
    { supplier: AKODESSEWA, iso: at(2, 24), transport_fee: 2000, items: [
      line('Lait en poudre 400g', 24, 'boîte', 2200), line('Eau minérale 1,5L', 12, 'pack de 6', 1500), line('Jus de fruit 1L', 24, 'brique', 850),
    ] },
    // Le mois dernier
    { supplier: ADAWLATO, iso: at(1, 2), transport_fee: 3000, items: [
      line('Sac de riz 25kg', 7, 'sac', 12450), line('Huile végétale 5L', 10, 'bidon', 4650), line('Sucre en poudre 1kg', 30, 'paquet', 650), line('Farine de blé 1kg', 20, 'sachet', 925),
    ] },
    { supplier: HEDZRANAWOE, iso: at(1, 8), transport_fee: 2500, items: [
      line('Tomate concentrée 400g', 48, 'boîte', 620), line('Spaghetti 500g', 60, 'paquet', 415), line('Sardines 125g', 50, 'boîte', 445),
    ] },
    { supplier: ASSIVITO, iso: at(1, 15), transport_fee: 1000, items: [
      line('Savon de ménage 400g', 48, 'pièce', 335), line('Cube Maggi (boîte de 100)', 5, 'boîte', 3000), line('Bougies (paquet de 6)', 20, 'paquet', 700),
    ] },
    { supplier: '', iso: at(1, 20), notes: 'Nom du vendeur absent sur le ticket.', items: [
      line('Piment en poudre 100g', 30, 'sachet', 300), line('Sel iodé 1kg', 20, 'paquet', 250),
    ] },
    { supplier: AKODESSEWA, iso: at(1, 26), transport_fee: 2000, items: [
      line('Lait en poudre 400g', 24, 'boîte', 2250), line('Eau minérale 1,5L', 15, 'pack de 6', 1500), line('Jus de fruit 1L', 24, 'brique', 875),
    ] },
    // Ce mois-ci
    { supplier: ADAWLATO, iso: at(0, 3), transport_fee: 3000, items: [
      line('Sac de riz 25kg', 7, 'sac', 12900), line('Huile végétale 5L', 10, 'bidon', 4800), line('Sucre en poudre 1kg', 30, 'paquet', 675), line('Farine de blé 1kg', 20, 'sachet', 950),
    ] },
    { supplier: HEDZRANAWOE, iso: at(0, 8), transport_fee: 2500, items: [
      line('Tomate concentrée 400g', 48, 'boîte', 640), line('Spaghetti 500g', 60, 'paquet', 420), line('Sardines 125g', 50, 'boîte', 450),
    ] },
    { supplier: ASSIVITO, iso: at(0, 11), transport_fee: 1000, status: 'rejected', notes: 'Photo floue, reçu repris le lendemain.', items: [
      line('Savon de ménage 400g', 48, 'pièce', 340),
    ] },
    { supplier: ASSIVITO, iso: at(0, 12), transport_fee: 1000, items: [
      line('Savon de ménage 400g', 48, 'pièce', 340), line('Cube Maggi (boîte de 100)', 5, 'boîte', 3050), line('Bougies (paquet de 6)', 24, 'paquet', 700),
    ] },
    { supplier: AKODESSEWA, iso: at(0, 13, 17), status: 'pending', notes: 'Lecture incertaine, vérifiez les quantités.', items: [
      line('Lait en poudre 400g', 24, 'boîte', 2300), line('Jus de fruit 1L', 24, 'brique', 900),
    ] },
  ];
}

/** Marges déjà apprises pour les produits vendus depuis longtemps. */
const KNOWN_MARGINS: Record<string, number> = {
  'sac de riz 25 kg': 0.1,
  'huile vegetale 5 l': 0.14,
  'sucre en poudre 1 kg': 0.2,
  'tomate concentree 400 g': 0.22,
  'savon de menage 400 g': 0.25,
  'spaghetti 500 g': 0.2,
  'lait en poudre 400 g': 0.15,
  'sardines 125 g': 0.22,
  'eau minerale 1 5 l': 0.2,
  'farine de ble 1 kg': 0.18,
};

function buildPrices(invoices: Invoice[]): ProductPrice[] {
  const map = new Map<string, ProductPrice>();
  [...invoices]
    .filter((inv) => inv.status === 'validated')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((inv) => {
      averagePurchasePrices(inv.invoice_items || []).forEach((p) => {
        const prev = map.get(p.product_key);
        const known = KNOWN_MARGINS[p.product_key];
        const margin = known ?? prev?.margin ?? null;
        const price = suggestSellingPrice(p.unit_price, margin ?? DEFAULT_MARGIN);
        // Les produits sans marge apprise restent « à confirmer » : l'écran Prix n'est pas vide.
        const confirmed = known != null;
        map.set(p.product_key, {
          product_key: p.product_key,
          product_name: p.product_name,
          margin,
          last_purchase_price: p.unit_price,
          previous_purchase_price: prev?.last_purchase_price ?? null,
          suggested_price: price,
          selling_price: confirmed ? price : (prev?.selling_price ?? null),
          status: confirmed ? 'confirmed' : 'pending',
          confirmations: confirmed ? (prev?.confirmations ?? 0) + 1 : (prev?.confirmations ?? 0),
          updated_at: inv.created_at,
        });
      });
    });
  return [...map.values()];
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Insère le jeu de données pour `ownerId` si ce compte n'a encore aucun reçu. */
export async function seedSampleData(ownerId: string): Promise<boolean> {
  const existing = await listInvoices(ownerId);
  if (existing.length) return false;

  const invoices: Invoice[] = [];
  let n = 0;
  for (const s of specs()) {
    n += 1;
    const id = `${ownerId}-r${String(n).padStart(2, '0')}`;
    const items = s.items.map((it, i) => ({ ...it, id: `${id}-${i}`, invoice_id: id }));
    const total = items.reduce((sum, it) => sum + Number(it.total_price), 0);
    const photo_path = await putPhoto(`${ownerId}-${id}`, receiptImage(s.supplier, dateLabel(s.iso), items, total));
    invoices.push({
      id,
      owner_id: ownerId,
      supplier_id: null,
      supplier_name_raw: s.supplier,
      invoice_date: s.iso.slice(0, 10),
      total_amount: total,
      transport_fee: s.transport_fee || 0,
      photo_path,
      status: s.status ?? 'validated',
      ocr_raw_data: { provider: 'tesseract.js', confidence: 0.86, raw_text: '', transport_fee: s.transport_fee || 0 },
      notes: s.notes || '',
      created_at: s.iso,
      updated_at: s.iso,
      invoice_items: items,
    });
  }
  await putInvoices(invoices);
  await putProductPrices(ownerId, buildPrices(invoices));
  await putSetting(ownerId, 'default_margin', DEFAULT_MARGIN);

  const avatar_path = await putPhoto(`avatar-${ownerId}`, avatarImage());
  await updateUserProfile(ownerId, { avatar_path });
  return true;
}
