import type { Invoice, Profile } from '../types/invoice';
import { formatDate, formatFcfa } from './invoices';
import { displaySupplier } from './supplier';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 30;
const BOTTOM_LIMIT = FOOTER_Y + 18;

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/* ---------- palette (sobre : un bleu, des gris, un vert) ---------- */
const C = {
  ink: '#111827',
  ink2: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',
  line: '#E5E7EB',
  surface: '#F3F4F6',
  blue: '#2563EB',
  blueSoft: '#EFF4FF',
  blueInk: '#1E3A8A',
  white: '#FFFFFF',
};

/* ---------- helpers encodage ---------- */

const NORM: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '–': '-',
  '—': '-',
  'œ': 'oe',
  'Œ': 'OE',
  ' ': ' ',
  ' ': ' ',
  '…': '...',
};

function pdfString(text: string): string {
  let out = '';
  for (let ch of text) {
    ch = NORM[ch] ?? ch;
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`;
    } else {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) out += ch;
      else if (c <= 255) out += `\\${c.toString(8).padStart(3, '0')}`;
      else out += '?';
    }
  }
  return out;
}

function latin1(s: string): Uint8Array {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
  return a;
}

/* ---------- helpers dessin (opérateurs PDF) ---------- */

const f2 = (n: number) => Number(n.toFixed(2));

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
}

function fillRect(x: number, y: number, w: number, h: number, c: string): string {
  return `${rgb(c)} rg ${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)} re f`;
}

function hLine(x: number, y: number, w: number, c: string, t = 0.6): string {
  return `q ${rgb(c)} RG ${t} w ${f2(x)} ${f2(y)} m ${f2(x + w)} ${f2(y)} l S Q`;
}

/** Chemin d'un rectangle arrondi (x, y = coin bas-gauche). */
function rrectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = 0.5523;
  return [
    `${f2(x + r)} ${f2(y)} m`,
    `${f2(x + w - r)} ${f2(y)} l`,
    `${f2(x + w - r + k * r)} ${f2(y)} ${f2(x + w)} ${f2(y + r - k * r)} ${f2(x + w)} ${f2(y + r)} c`,
    `${f2(x + w)} ${f2(y + h - r)} l`,
    `${f2(x + w)} ${f2(y + h - r + k * r)} ${f2(x + w - r + k * r)} ${f2(y + h)} ${f2(x + w - r)} ${f2(y + h)} c`,
    `${f2(x + r)} ${f2(y + h)} l`,
    `${f2(x + r - k * r)} ${f2(y + h)} ${f2(x)} ${f2(y + h - r + k * r)} ${f2(x)} ${f2(y + h - r)} c`,
    `${f2(x)} ${f2(y + r)} l`,
    `${f2(x)} ${f2(y + r - k * r)} ${f2(x + r - k * r)} ${f2(y)} ${f2(x + r)} ${f2(y)} c`,
    'h',
  ].join('\n');
}

function fillRRect(x: number, y: number, w: number, h: number, r: number, c: string): string {
  return `q ${rgb(c)} rg\n${rrectPath(x, y, w, h, r)}\nf\nQ`;
}



function text(x: number, y: number, s: string, size: number, bold: boolean, c: string, tracking = 0): string {
  const tc = tracking ? `${tracking} Tc ` : '';
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${tc}${rgb(c)} rg ${f2(x)} ${f2(y)} Td (${pdfString(s)}) Tj ET`;
}

function textWidth(s: string, size: number): number {
  let t = 0;
  for (const ch of s) {
    if (ch === ' ') t += 278;
    else if ("iljI.,;:!|'’`ftr()[]{}".includes(ch)) t += 300;
    else if ('0123456789'.includes(ch)) t += 556;
    else if ('mwMW'.includes(ch)) t += 850;
    else if (ch >= 'A' && ch <= 'Z') t += 680;
    else t += 500;
  }
  return (t / 1000) * size;
}

function textRight(xR: number, y: number, s: string, size: number, bold: boolean, c: string, tracking = 0): string {
  return text(xR - textWidth(s, size) - (tracking ? tracking * s.length : 0), y, s, size, bold, c, tracking);
}


function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ---------- moteur PDF ---------- */

function buildPdf(pagesOps: string[][]): Uint8Array {
  const nPages = Math.max(pagesOps.length, 1);
  const opsPages = pagesOps.length ? pagesOps : [['BT /F1 10 Tf 48 794 Td ( ) Tj ET']];
  const pageIds = opsPages.map((_, i) => 3 + i * 2);
  const contentIds = opsPages.map((_, i) => 4 + i * 2);
  const fontRegularId = 3 + nPages * 2;
  const fontBoldId = fontRegularId + 1;
  const objects: string[] = new Array(fontBoldId);

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${nPages} >>`;

  opsPages.forEach((ops, i) => {
    const stream = ops.join('\n');
    objects[pageIds[i] - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
    objects[contentIds[i] - 1] = `<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontRegularId - 1] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[fontBoldId - 1] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(latin1(body).length);
    body += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = latin1(body).length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return latin1(body);
}

export function monthLabelFr(year: number, month: number): string {
  return `${MONTHS_FR[month - 1] || month} ${year}`;
}

/* ---------- rendu du relevé mensuel ---------- */

export function buildMonthlyPdf(options: {
  profile: Profile | null;
  year: number;
  month: number;
  invoices: Invoice[];
}): Uint8Array {
  const { profile, year, month, invoices } = options;
  const total = invoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
  const transport = invoices.reduce((s, inv) => s + Number(inv.transport_fee || 0), 0);
  const period = monthLabelFr(year, month);
  const periodCap = period.charAt(0).toUpperCase() + period.slice(1);
  const generated = new Date().toLocaleDateString('fr-FR');
  const commerce = profile?.nom_commerce || 'Mon commerce';
  const owner = profile?.nom_personne || '';
  const contact = [profile?.telephone ? `Tél. ${profile.telephone}` : '', profile?.adresse || profile?.quartier || '']
    .filter(Boolean)
    .join(' · ');

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;

  const header = (first: boolean) => {
    ops = [];
    pages.push(ops);
    const top = PAGE_H - MARGIN;
    ops.push(text(MARGIN, top - 14, 'e', 16, true, C.blue));
    ops.push(text(MARGIN + textWidth('e', 16), top - 14, 'facture', 16, true, C.ink));
    ops.push(textRight(PAGE_W - MARGIN, top - 8, 'Relevé des achats', 9, false, C.muted));
    ops.push(textRight(PAGE_W - MARGIN, top - 22, periodCap, 13, true, C.ink));
    ops.push(hLine(MARGIN, top - 32, CONTENT_W, C.line, 0.8));
    y = top - 48;
    if (!first) y -= 4;
  };

  const ensure = (h: number) => {
    if (y - h < BOTTOM_LIMIT) header(false);
  };

  header(true);

  /* ---- commerçant ---- */
  ops.push(text(MARGIN, y - 4, commerce, 13, true, C.ink));
  y -= 18;
  if (owner) {
    ops.push(text(MARGIN, y - 2, owner, 9.5, false, C.ink2));
    y -= 14;
  }
  if (contact) {
    ops.push(text(MARGIN, y - 2, contact, 8.5, false, C.muted));
    y -= 14;
  }
  y -= 8;

  /* ---- résumé : trois cases ---- */
  const boxH = 50;
  const gap = 10;
  const boxW = (CONTENT_W - gap * 2) / 3;
  const boxes: [string, string, string, string][] = [
    ['Total des achats', formatFcfa(total), C.blueSoft, C.blueInk],
    ['Reçus validés', String(invoices.length), C.surface, C.ink],
    ['Transport', formatFcfa(transport), C.surface, C.ink],
  ];
  boxes.forEach(([label, value, bg, fg], i) => {
    const bx = MARGIN + i * (boxW + gap);
    ops.push(fillRRect(bx, y - boxH, boxW, boxH, 8, bg));
    ops.push(text(bx + 12, y - 17, label, 8, false, C.muted));
    ops.push(text(bx + 12, y - 36, value, 12.5, true, fg));
  });
  y -= boxH + 22;

  /* ---- tableau des reçus ---- */
  const colDate = MARGIN;
  const colSupplier = MARGIN + 62;
  const colItems = MARGIN + 230;
  const colAmountR = MARGIN + CONTENT_W;
  const rowH = 18;

  const tableHeader = () => {
    ensure(rowH + 10);
    ops.push(fillRRect(MARGIN, y - rowH, CONTENT_W, rowH, 4, C.surface));
    ops.push(text(colDate + 8, y - 12, 'Date', 8, true, C.ink2));
    ops.push(text(colSupplier, y - 12, 'Fournisseur', 8, true, C.ink2));
    ops.push(text(colItems, y - 12, 'Articles', 8, true, C.ink2));
    ops.push(textRight(colAmountR - 8, y - 12, 'Montant', 8, true, C.ink2));
    y -= rowH;
  };

  ops.push(text(MARGIN, y - 4, 'Détail des reçus', 10.5, true, C.ink));
  y -= 16;

  if (!invoices.length) {
    ops.push(text(MARGIN, y - 10, 'Aucun reçu validé pour ce mois.', 9, false, C.muted));
    y -= 24;
  } else {
    tableHeader();
    invoices.forEach((inv, idx) => {
      const items = inv.invoice_items || [];
      const itemLines = Math.max(1, items.length);
      const h = 8 + itemLines * 11 + 6;
      if (y - h < BOTTOM_LIMIT) {
        header(false);
        tableHeader();
      }
      if (idx % 2 === 1) ops.push(fillRect(MARGIN, y - h, CONTENT_W, h, '#FAFAFA'));
      const date = formatDate(inv.invoice_date || inv.created_at);
      ops.push(text(colDate + 8, y - 13, date, 8, false, C.ink2));
      ops.push(text(colSupplier, y - 13, truncate(displaySupplier(inv.supplier_name_raw), 32), 8.5, true, C.ink));
      if (!items.length) {
        ops.push(text(colItems, y - 13, 'Sans détail', 8, false, C.faint));
      } else {
        items.forEach((it, i) => {
          ops.push(text(colItems, y - 13 - i * 11, `${truncate(it.product_name, 34)} x ${it.quantity}`, 8, false, C.ink2));
        });
      }
      ops.push(textRight(colAmountR - 8, y - 13, formatFcfa(Number(inv.total_amount)), 8.5, true, C.ink));
      if (Number(inv.transport_fee || 0) > 0) {
        ops.push(textRight(colAmountR - 8, y - 24, `+ ${formatFcfa(Number(inv.transport_fee))} transport`, 7, false, C.muted));
      }
      ops.push(hLine(MARGIN, y - h, CONTENT_W, C.line, 0.5));
      y -= h;
    });

    /* total */
    ensure(30);
    y -= 6;
    ops.push(fillRRect(MARGIN, y - 24, CONTENT_W, 24, 6, C.blueSoft));
    ops.push(text(MARGIN + 10, y - 15.5, 'Total du mois (reçus + transport)', 9, true, C.blueInk));
    ops.push(textRight(colAmountR - 10, y - 15.5, formatFcfa(total + transport), 10.5, true, C.blueInk));
    y -= 40;

    /* répartition par fournisseur */
    const bySupplier = new Map<string, number>();
    invoices.forEach((inv) => {
      const k = displaySupplier(inv.supplier_name_raw);
      bySupplier.set(k, (bySupplier.get(k) || 0) + Number(inv.total_amount));
    });
    const suppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (suppliers.length > 1) {
      ensure(30 + suppliers.length * 18);
      ops.push(text(MARGIN, y - 4, 'Par fournisseur', 10.5, true, C.ink));
      y -= 18;
      const maxV = suppliers[0][1] || 1;
      const barX = MARGIN + 150;
      const barW = CONTENT_W - 150 - 80;
      suppliers.forEach(([name, v]) => {
        ensure(18);
        ops.push(text(MARGIN, y - 11, truncate(name, 26), 8.5, false, C.ink2));
        ops.push(fillRRect(barX, y - 13, barW, 7, 3.5, C.surface));
        ops.push(fillRRect(barX, y - 13, Math.max(6, (barW * v) / maxV), 7, 3.5, C.blue));
        ops.push(textRight(colAmountR, y - 11, formatFcfa(v), 8.5, true, C.ink));
        y -= 18;
      });
    }
  }

  /* ---- pied de page ---- */
  const n = pages.length;
  pages.forEach((p, i) => {
    p.push(hLine(MARGIN, FOOTER_Y + 10, CONTENT_W, C.line, 0.6));
    p.push(text(MARGIN, FOOTER_Y, `Généré le ${generated} avec efacture · reçus validés uniquement`, 7, false, C.muted));
    p.push(textRight(PAGE_W - MARGIN, FOOTER_Y, `Page ${i + 1} / ${n}`, 7, false, C.muted));
  });

  return buildPdf(pages);
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
