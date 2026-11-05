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

/* ---------- palette (style saphir / minéral de l'app) ---------- */
const C = {
  navy: '#0F172A',
  deep: '#172554',
  sapphire: '#1E3A8A',
  electric: '#2563EB',
  cyan: '#06B6D4',
  mint: '#10B981',
  sky: '#7DD3FC',
  frost: '#64748B',
  muted: '#94A3B8',
  border: '#CBD5E1',
  surface: '#EEF2F6',
  surfaceAlt: '#F4F7FA',
  slate300: '#CBD5E1',
  amber: '#B45309',
  sand: '#FEF7EC',
  sandBorder: '#F0DFBE',
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

function strokeRRect(x: number, y: number, w: number, h: number, r: number, c: string, t = 0.8): string {
  return `q ${rgb(c)} RG ${t} w\n${rrectPath(x, y, w, h, r)}\nS\nQ`;
}

function clipRRect(x: number, y: number, w: number, h: number, r: number): string {
  return `q\n${rrectPath(x, y, w, h, r)}\nW n`;
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

function textCenter(xC: number, y: number, s: string, size: number, bold: boolean, c: string): string {
  return text(xC - textWidth(s, size) / 2, y, s, size, bold, c);
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

/* ---------- rendu du rapport ---------- */

export function buildMonthlyPdf(options: {
  profile: Profile | null;
  year: number;
  month: number;
  invoices: Invoice[];
}): Uint8Array {
  const { profile, year, month, invoices } = options;
  const total = invoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
  const period = monthLabelFr(year, month);
  const periodCap = period.charAt(0).toUpperCase() + period.slice(1);
  const generated = new Date().toLocaleDateString('fr-FR');
  const commerce = profile?.nom_commerce || 'Commerce';
  const contact = [
    profile?.telephone ? `Tél : ${profile.telephone}` : '',
    profile?.quartier ? `Quartier : ${profile.quartier}` : '',
  ]
    .filter(Boolean)
    .join(' · ') || `Quartier : ${profile?.quartier || '-'}`;

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;

  const newPage = (first: boolean) => {
    ops = [];
    pages.push(ops);
    if (first) {
      // Bandeau navy + liseré cyan/menthe (style écran d'accueil)
      ops.push(fillRect(0, PAGE_H - 96, PAGE_W, 96, C.navy));
      ops.push(`q\n0 ${PAGE_H - 96} ${PAGE_W} 96 re W n`);
      ops.push(fillRect(PAGE_W - 150, PAGE_H - 150, 190, 190, C.deep));
      ops.push('Q');
      ops.push(fillRect(0, PAGE_H - 99, PAGE_W * 0.62, 3, C.cyan));
      ops.push(fillRect(PAGE_W * 0.62, PAGE_H - 99, PAGE_W * 0.38, 3, C.mint));
      const ex = MARGIN;
      ops.push(text(ex, PAGE_H - 54, 'e', 20, true, C.electric));
      ops.push(text(ex + textWidth('e', 20), PAGE_H - 54, 'facture', 20, true, C.white));
      ops.push(textRight(PAGE_W - MARGIN, PAGE_H - 44, 'RAPPORT MENSUEL', 7.5, true, C.sky, 1.4));
      ops.push(textRight(PAGE_W - MARGIN, PAGE_H - 62, periodCap, 14, true, C.white));
      ops.push(textRight(PAGE_W - MARGIN, PAGE_H - 76, `${invoices.length} facture(s) validée(s)`, 8, false, C.slate300));
      y = PAGE_H - 96 - 26;
    } else {
      ops.push(fillRect(0, PAGE_H - 28, PAGE_W, 28, C.navy));
      ops.push(fillRect(0, PAGE_H - 30.5, PAGE_W * 0.62, 2.5, C.cyan));
      ops.push(fillRect(PAGE_W * 0.62, PAGE_H - 30.5, PAGE_W * 0.38, 2.5, C.mint));
      ops.push(text(MARGIN, PAGE_H - 19, 'efacture', 8.5, true, C.white));
      ops.push(textRight(PAGE_W - MARGIN, PAGE_H - 19, `Rapport mensuel · ${periodCap}`, 8, false, C.slate300));
      y = PAGE_H - 30 - 22;
    }
  };

  const ensure = (h: number) => {
    if (y - h < BOTTOM_LIMIT) newPage(false);
  };

  /* ---- page 1 : bandeau ---- */
  newPage(true);

  /* ---- bloc commerçant ---- */
  const pillLabel = 'MARCHÉ LOCAL';
  const pillW = textWidth(pillLabel, 7.5) + 16;
  ops.push(fillRRect(MARGIN, y - 3, pillW, 14.5, 7, C.surface));
  ops.push(strokeRRect(MARGIN, y - 3, pillW, 14.5, 7, C.border, 0.7));
  ops.push(text(MARGIN + (pillW - textWidth(pillLabel, 7.5)) / 2, y + 1.5, pillLabel, 7.5, true, C.sapphire, 0.6));
  ops.push(text(MARGIN + pillW + 8, y + 1.5, '· Togo', 8.5, false, C.frost));
  y -= 22;
  ops.push(text(MARGIN, y - 10, commerce, 14, true, C.navy));
  y -= 24;
  ops.push(text(MARGIN, y - 6, contact, 8.5, false, C.frost));
  y -= 22;

  /* ---- carte héro : dépenses du mois ---- */
  const heroH = 78;
  const heroY = y;
  ops.push(fillRRect(MARGIN, heroY - heroH, CONTENT_W, heroH, 10, C.navy));
  ops.push(clipRRect(MARGIN, heroY - heroH, CONTENT_W, heroH, 10));
  ops.push(fillRect(MARGIN, heroY - 3, CONTENT_W * 0.62, 3, C.cyan));
  ops.push(fillRect(MARGIN + CONTENT_W * 0.62, heroY - 3, CONTENT_W * 0.38, 3, C.mint));
  ops.push('Q');
  ops.push(fillRRect(MARGIN + 16, heroY - 17, 5, 5, 2.5, C.sky));
  ops.push(text(MARGIN + 26, heroY - 19, 'DÉPENSES DU MOIS', 8, true, C.sky, 1));
  ops.push(text(MARGIN + 16, heroY - 48, formatFcfa(total), 21, true, C.white));
  const proLabel = 'COMPTE PRO';
  const proW = textWidth(proLabel, 7.5) + 16;
  ops.push(fillRRect(MARGIN + CONTENT_W - 16 - proW, heroY - 24, proW, 14, 7, '#1E293B'));
  ops.push(strokeRRect(MARGIN + CONTENT_W - 16 - proW, heroY - 24, proW, 14, 7, '#475569', 0.7));
  ops.push(text(MARGIN + CONTENT_W - 16 - proW / 2 - textWidth(proLabel, 7.5) / 2, heroY - 19.5, proLabel, 7.5, true, C.slate300, 1));
  ops.push(hLine(MARGIN + 16, heroY - 60, CONTENT_W - 32, '#334155', 0.7));
  ops.push(fillRRect(MARGIN + 16, heroY - 71, 5, 5, 2.5, C.mint));
  ops.push(text(MARGIN + 26, heroY - 70, 'Bilan provisoire consolidé', 8, false, C.slate300));
  ops.push(textRight(MARGIN + CONTENT_W - 16, heroY - 70, 'Journal à jour', 8, true, C.mint));
  y = heroY - heroH - 24;

  /* ---- titre section ---- */
  ops.push(fillRRect(MARGIN, y + 1, 6, 6, 3, C.electric));
  ops.push(text(MARGIN + 12, y, 'DÉTAIL DES FACTURES', 9.5, true, C.navy, 0.6));
  const countLabel = `${invoices.length} opération${invoices.length > 1 ? 's' : ''}`;
  const countW = textWidth(countLabel, 7.5) + 14;
  ops.push(fillRRect(MARGIN + CONTENT_W - countW, y - 3.5, countW, 14, 7, C.surface));
  ops.push(strokeRRect(MARGIN + CONTENT_W - countW, y - 3.5, countW, 14, 7, C.border, 0.7));
  ops.push(text(MARGIN + CONTENT_W - countW + (countW - textWidth(countLabel, 7.5)) / 2, y, countLabel, 7.5, true, C.sapphire));
  y -= 16;

  /* ---- liste des factures en cartes ---- */
  const CHIP_COLORS: [string, string][] = [
    ['#DBEAFE', '#1E3A8A'], // bleu
    ['#FEF3C7', '#B45309'], // ambre
    ['#CFFAFE', '#0E7490'], // cyan
    ['#D1FAE5', '#059669'], // menthe
  ];
  const chipFor = (name: string): [string, string] =>
    CHIP_COLORS[(name.charCodeAt(0) || 0) % CHIP_COLORS.length];

  if (!invoices.length) {
    ensure(44);
    ops.push(fillRRect(MARGIN, y - 40, CONTENT_W, 40, 10, C.surfaceAlt));
    ops.push(strokeRRect(MARGIN, y - 40, CONTENT_W, 40, 10, C.border, 0.8));
    ops.push(textCenter(MARGIN + CONTENT_W / 2, y - 24, 'Aucune facture validée pour ce mois.', 9, false, C.frost));
    y -= 48;
  } else {
    invoices.forEach((inv) => {
      const items = inv.invoice_items || [];
      const itemLines = Math.max(items.length, 1);
      const blockH = 38 + itemLines * 11.5 + 8;
      ensure(blockH + 8);
      const y0 = y;

      const date = formatDate(inv.invoice_date || inv.created_at);
      const supplier = truncate(displaySupplier(inv.supplier_name_raw), 30);
      const [chipBg, chipFg] = chipFor(supplier);

      /* carte + barre colorée à gauche */
      ops.push(fillRRect(MARGIN, y0 - blockH, CONTENT_W, blockH, 9, C.white));
      ops.push(strokeRRect(MARGIN, y0 - blockH, CONTENT_W, blockH, 9, C.surface, 1));
      ops.push(clipRRect(MARGIN, y0 - blockH, CONTENT_W, blockH, 9));
      ops.push(fillRect(MARGIN, y0 - blockH, 4, blockH, chipFg));
      ops.push('Q');

      /* pastille initiale */
      ops.push(fillRRect(MARGIN + 11, y0 - 24, 15, 15, 5, chipBg));
      ops.push(textCenter(MARGIN + 18.5, y0 - 20, supplier.charAt(0).toUpperCase(), 8, true, chipFg));

      /* fournisseur + montant + date + statut */
      ops.push(text(MARGIN + 32, y0 - 16, supplier, 9.5, true, C.navy));
      ops.push(textRight(MARGIN + CONTENT_W - 11, y0 - 16, formatFcfa(Number(inv.total_amount)), 9.5, true, C.sapphire));
      ops.push(text(MARGIN + 32, y0 - 26, date, 7.5, false, C.frost));
      ops.push(textRight(MARGIN + CONTENT_W - 11, y0 - 26, 'Validée', 7, true, C.mint));
      ops.push(hLine(MARGIN + 11, y0 - 30, CONTENT_W - 22, C.surface, 0.6));

      /* lignes produits */
      let iy = y0 - 42;
      if (!items.length) {
        ops.push(text(MARGIN + 32, iy, '· pas de lignes produits', 7.5, false, C.muted));
      } else {
        items.forEach((item) => {
          ops.push(
            text(MARGIN + 32, iy, `· ${truncate(item.product_name, 30)}  x${item.quantity}`, 7.5, false, C.frost),
          );
          ops.push(textRight(MARGIN + CONTENT_W - 11, iy, formatFcfa(Number(item.total_price)), 7.5, false, C.frost));
          iy -= 11.5;
        });
      }
      y -= blockH + 8;
    });

    /* répartition par fournisseur */
    const bySupplier = new Map<string, number>();
    invoices.forEach((inv) => {
      const k = displaySupplier(inv.supplier_name_raw);
      bySupplier.set(k, (bySupplier.get(k) || 0) + Number(inv.total_amount));
    });
    const suppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (suppliers.length) {
      y -= 4;
      ensure(30);
      ops.push(fillRRect(MARGIN, y + 1, 6, 6, 3, C.cyan));
      ops.push(text(MARGIN + 12, y, 'RÉPARTITION PAR FOURNISSEUR', 9.5, true, C.navy, 0.6));
      y -= 14;
      const maxV = suppliers[0][1] || 1;
      suppliers.forEach(([name, v]) => {
        ensure(20);
        ops.push(text(MARGIN + 2, y - 12, truncate(name, 24), 8, true, C.navy));
        ops.push(textRight(MARGIN + CONTENT_W - 2, y - 12, formatFcfa(v), 8, true, C.sapphire));
        ops.push(fillRRect(MARGIN + 2, y - 19, CONTENT_W - 4, 6, 3, C.surface));
        const bw = Math.max(10, ((CONTENT_W - 4) * v) / maxV);
        ops.push(fillRRect(MARGIN + 2, y - 19, bw, 6, 3, C.electric));
        ops.push(fillRRect(MARGIN + 2 + bw - 8, y - 19, 8, 6, 3, C.cyan));
        y -= 20;
      });
      y -= 6;
    }

    /* barre total navy */
    ensure(34);
    ops.push(fillRRect(MARGIN, y - 26, CONTENT_W, 26, 8, C.navy));
    ops.push(clipRRect(MARGIN, y - 26, CONTENT_W, 26, 8));
    ops.push(fillRect(MARGIN, y - 2.5, CONTENT_W * 0.62, 2.5, C.cyan));
    ops.push(fillRect(MARGIN + CONTENT_W * 0.62, y - 2.5, CONTENT_W * 0.38, 2.5, C.mint));
    ops.push('Q');
    ops.push(text(MARGIN + 14, y - 16, 'TOTAL DE LA PÉRIODE', 8, true, C.sky, 0.8));
    ops.push(textRight(MARGIN + CONTENT_W - 14, y - 16, formatFcfa(total), 10.5, true, C.white));
    y -= 34;
  }

  /* ---- pied de page sur chaque page ---- */
  const n = pages.length;
  pages.forEach((p, i) => {
    p.push(hLine(MARGIN, FOOTER_Y + 10, CONTENT_W, C.border, 0.6));
    p.push(text(MARGIN, FOOTER_Y, 'e', 7.5, true, C.electric));
    p.push(text(MARGIN + textWidth('e', 7.5), FOOTER_Y, 'facture', 7.5, true, C.navy));
    p.push(
      text(
        MARGIN + textWidth('efacture', 7.5) + 4,
        FOOTER_Y,
        `— Document généré le ${generated} · Pièces validées uniquement`,
        7,
        false,
        C.frost,
      ),
    );
    p.push(textRight(PAGE_W - MARGIN, FOOTER_Y, `Page ${i + 1} / ${n}`, 7, false, C.frost));
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
  URL.revokeObjectURL(url);
}

export function buildMonthlyCsv(invoices: Invoice[]): string {
  const header = ['Date', 'Fournisseur', 'Produit', 'Quantite', 'Prix unitaire', 'Total ligne', 'Total facture'];
  const rows = [header.join(';')];
  invoices.forEach((inv) => {
    const date = formatDate(inv.invoice_date || inv.created_at);
    const supplier = displaySupplier(inv.supplier_name_raw);
    const items = inv.invoice_items || [];
    if (!items.length) {
      rows.push(
        [date, supplier, '', '', '', '', String(Math.round(Number(inv.total_amount)))].join(';'),
      );
      return;
    }
    items.forEach((item) => {
      rows.push(
        [
          date,
          supplier,
          item.product_name,
          String(item.quantity),
          String(Math.round(Number(item.unit_price))),
          String(Math.round(Number(item.total_price))),
          String(Math.round(Number(inv.total_amount))),
        ].join(';'),
      );
    });
  });
  return `\uFEFF${rows.join('\n')}`;
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
