import type { OCRItem, OCRResult } from '../../types/invoice';

const MONTHS: Record<string, string> = {
  janvier: '01',
  février: '02',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  août: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  décembre: '12',
  decembre: '12',
};

const MONTH_NAME =
  /janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre/i;

const SKIP_ITEM =
  /^(total|montant|facture|date|tel|tél|phone|ifu|rc\b|doit|arrêté|arrete|merci|n°|no\b|désignation|designation|quantit|prix|unité|unite|client|vendeur|tva|sous[-\s]?total)/i;

const SKIP_ITEM_BODY = /capital|registre|rccm|\bnif\b|ifu n|n[°o]\s*ifu|\btva\b|sous[-\s]?total/i;

const SKIP_SUPPLIER =
  /^(facture|reçu|recu|ticket|date|total|montant|merci|tel|tél|phone|n°|no\b|doit|achat |association|ifu|rc\b|bp\b|arrêté|arrete|client|vendeur|attention|à l['’]atte)/i;

const TAX_OR_SUBTOTAL = /tva|taxe|tax\b|sous[-\s]?total|sub[-\s]?total|\d{1,3}\s*%/i;

const GRAND_TOTAL_LABEL =
  /(?:total\s*(?:g[ée]n[ée]ral(?:e)?|ttc)?|montant(?:\s*ttc)?|net(?:\s*[àa]\s*payer)?|[àa]\s*payer|somme)\b/i;

const CURRENCY = /(?:FCFA|CFA|\bF\b|€|EUR|euros?)/i;

/** Formes juridiques / types de commerce — pas des noms de magasins. */
const LEGAL_FORM =
  /\b(s\.?a\.?r\.?l\.?|sarl|s\.?a\.?s\.?|sas|s\.?a\b|ets|etablissement|établissement|st[ée]|soci[eé]t[eé])\b/i;

const BUSINESS_KIND =
  /alimentation|grossiste|boutique|pharmacie|quincaillerie|superette|sup[eé]rette|supermarch|commerce|march[eé]|magasin|boulangerie|p[aâ]tisserie|station[\s-]?service|d[eé]p[oô]t|librairie|clinique|h[oô]tel|restaurant|n[eé]goce|minimarket|cash\s*and\s*carry|primeur|boucherie|poissonnerie|droguerie|couture|atelier/i;

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Montants FCFA : 360.250 / 360 250 / 33 500 → 360250, pas 360.25 */
function parseFcfa(value: string | number | undefined): number {
  let s = String(value ?? '').trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,\s]/g, '').replace(/\s+/g, '');
  if (!s) return 0;

  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    const n = parseInt(s.replace(/[.,]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length === 3 ? parts.join('') : s.replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (last.length === 3) s = parts.join('');
  }

  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function parseFrenchDate(text: string): string | null {
  const toISO = (year: string | number, month: string, day: string): string | null => {
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = typeof year === 'number' ? year : parseInt(year, 10);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const written = text.match(
    /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
  );
  if (written) {
    const month = MONTHS[written[2].toLowerCase()];
    if (month) {
      const iso = toISO(written[3], month, written[1]);
      if (iso) return iso;
    }
  }
  const numeric = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (numeric) {
    const iso = toISO(numeric[3], numeric[2], numeric[1]);
    if (iso) return iso;
  }
  const short = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})(?!\d)/);
  if (short) {
    const yy = parseInt(short[3], 10);
    const year = yy >= 90 ? 1900 + yy : 2000 + yy;
    const iso = toISO(year, short[2], short[1]);
    if (iso) return iso;
  }
  const isoMatch = text.match(/(\d{4})[/.-](\d{2})[/.-](\d{2})/);
  if (isoMatch) {
    const iso = toISO(isoMatch[1], isoMatch[2], isoMatch[3]);
    if (iso) return iso;
  }
  return null;
}

function nearlyEqual(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= 0.03;
}

/** Lettres que Tesseract confond avec 0 dans un groupe de milliers (« 34 goo », « 73 75e »). */
const ZERO_LIKE = /[oOQDgGeEé]/g;

/**
 * Corrige les confusions lettre/chiffre les plus courantes, uniquement en contexte numérique :
 * « 34 goo » → « 34 000 », « 73 75e » → « 73 750 », « 10 S 500 » → « 10 5 500 », « ©3 » → « 03 ».
 */
function normalizeOcrLine(line: string): string {
  const fixed = line.replace(/[©@](?=\d)/g, '0').replace(/(?<=\d)[©@]/g, '0');
  const words = fixed.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 2];
    const next = words[i + 2];
    // groupe de milliers (3 caractères) qui suit un nombre de 1 à 3 chiffres
    if (prev && /^\d{1,3}$/.test(prev) && /^[\doOQDgGeEé]{3}$/.test(w) && /[^\d]/.test(w)) {
      words[i] = w.replace(ZERO_LIKE, '0');
    }
    // « S » / « l » isolés devant un groupe de milliers : 5 / 1
    if (/^[Ss]$/.test(w) && next && /^\d{3}$/.test(next)) words[i] = '5';
    if (/^[lI|]$/.test(w) && next && /^\d{3}$/.test(next)) words[i] = '1';
  }
  return words.join('');
}

/** Nombre de zéros finaux : les prix FCFA sont presque toujours « ronds ». */
function roundness(n: number): number {
  let z = 0;
  let v = Math.round(n);
  while (v > 0 && v % 10 === 0) {
    z++;
    v /= 10;
  }
  return z + (Math.round(n) % 25 === 0 ? 0.5 : 0);
}

/**
 * Quantité × prix unitaire ≈ total mais pas exactement : un chiffre a été mal lu.
 * On garde la lecture la plus « ronde » (5 509 × 10 / 55 000 → 5 500 ; 3 200 × 20 / 64 009 → 64 000).
 */
function reconcileAmounts(qty: number, unitPrice: number, total: number): { unitPrice: number; total: number } {
  if (qty <= 0 || Math.abs(qty * unitPrice - total) < 1) return { unitPrice, total };
  const fromTotal = total / qty;
  const fromPrice = qty * unitPrice;
  const keepTotal = Number.isInteger(fromTotal) && roundness(fromTotal) >= roundness(unitPrice);
  const keepPrice = roundness(fromPrice) > roundness(total);
  if (keepTotal && !keepPrice) return { unitPrice: fromTotal, total };
  if (keepPrice) return { unitPrice, total: fromPrice };
  return { unitPrice, total };
}

function looksLikeGarbage(line: string): boolean {
  const letters = (line.match(/[a-zA-ZàâéèêëïîôùûüçÀÂÉÈÊËÏÎÔÙÛÜÇ]/g) || []).length;
  const vowels = (line.match(/[aeiouyàâéèêëïîôùûüAEIOUYÀÂÉÈÊËÏÎÔÙÛÜ]/g) || []).length;
  if (letters >= 8 && vowels / letters < 0.22) return true;
  const compact = line.replace(/\s/g, '');
  const digits = (compact.match(/\d/g) || []).length;
  if (digits / Math.max(compact.length, 1) > 0.45) return true;
  const words = line.split(/\s+/).filter(Boolean);
  const shortCaps = words.filter((w) => /^[A-Z]{1,3}$/.test(w) && !/^(SA|ETS|STE|STÉ|SAS)$/.test(w)).length;
  return words.length >= 4 && shortCaps >= 3;
}

function looksLikeDateLine(line: string): boolean {
  if (parseFrenchDate(line)) return true;
  return MONTH_NAME.test(line) && /\b(19|20)\d{2}\b/.test(line);
}

function isLikelyYear(n: number): boolean {
  return n >= 1990 && n <= 2099 && Number.isInteger(n);
}

function stripLineNoise(name: string): string {
  return name
    .replace(/[|│¦]/g, ' ')
    .replace(/^\d{1,3}\s+/, '')
    .replace(/unit[ée]s?/gi, ' ')
    .replace(/\b(?:pcs?|pce|pi[eè]ces?)\b/gi, ' ')
    .replace(/^[\s\-•|:]+|[\s\-•|:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type DigitTok = { raw: string; index: number };

function digitTokens(line: string): DigitTok[] {
  return [...line.matchAll(/\d+/g)].map((m) => ({ raw: m[0], index: m.index ?? 0 }));
}

function asInt(raw: string): number {
  return parseInt(raw, 10) || 0;
}

function joinThousands(hi: string, lo: string): number {
  return asInt(hi) * 1000 + asInt(lo);
}

/** qty × PU ≈ total, avec millésimes FCFA (70 000 / 12 500) — sans nom de magasin. */
function parseTableAmounts(tokens: DigitTok[]): { qty: number; unitPrice: number; total: number; used: number } | null {
  const n = tokens.length;
  if (n < 3) return null;

  type Attempt = { qty: number; unitPrice: number; total: number; used: number; qtyRaw: string };
  const attempts: Attempt[] = [];
  const last = tokens[n - 1];
  const prev = tokens[n - 2];
  const prev2 = n >= 3 ? tokens[n - 3] : null;
  const prev3 = n >= 4 ? tokens[n - 4] : null;
  const prev4 = n >= 5 ? tokens[n - 5] : null;

  if (n >= 3 && prev2) {
    // qté, PU, total (tableau CFA)
    attempts.push({
      qty: asInt(prev2.raw),
      unitPrice: asInt(prev.raw),
      total: asInt(last.raw),
      used: 3,
      qtyRaw: prev2.raw,
    });
    // PU, qté, total (DESCRIPTION / PRIX / QUANTITÉ / TOTAL)
    attempts.push({
      qty: asInt(prev.raw),
      unitPrice: asInt(prev2.raw),
      total: asInt(last.raw),
      used: 3,
      qtyRaw: prev.raw,
    });
  }
  if (n >= 4 && last.raw.length === 3 && prev3 && prev2) {
    attempts.push({
      qty: asInt(prev3.raw),
      unitPrice: asInt(prev2.raw),
      total: joinThousands(prev.raw, last.raw),
      used: 4,
      qtyRaw: prev3.raw,
    });
    attempts.push({
      qty: asInt(prev2.raw),
      unitPrice: asInt(prev3.raw),
      total: joinThousands(prev.raw, last.raw),
      used: 4,
      qtyRaw: prev2.raw,
    });
  }
  if (n >= 4 && prev.raw.length === 3 && prev3 && prev2) {
    attempts.push({
      qty: asInt(prev3.raw),
      unitPrice: joinThousands(prev2.raw, prev.raw),
      total: asInt(last.raw),
      used: 4,
      qtyRaw: prev3.raw,
    });
  }
  if (n >= 5 && last.raw.length === 3 && prev2 && prev2.raw.length === 3 && prev4 && prev3) {
    attempts.push({
      qty: asInt(prev4.raw),
      unitPrice: joinThousands(prev3.raw, prev2.raw),
      total: joinThousands(prev.raw, last.raw),
      used: 5,
      qtyRaw: prev4.raw,
    });
    attempts.push({
      qty: asInt(prev2.raw),
      unitPrice: joinThousands(prev4.raw, prev3.raw),
      total: joinThousands(prev.raw, last.raw),
      used: 5,
      qtyRaw: prev2.raw,
    });
  }

  const valid = attempts.filter(
    (a) =>
      a.qty >= 1 &&
      a.qty <= 99_999 &&
      a.unitPrice >= 1 &&
      a.total >= 50 &&
      nearlyEqual(a.qty * a.unitPrice, a.total),
  );
  if (!valid.length) return null;
  valid.sort((a, b) => {
    const lead = (raw: string) => (/^0\d+$/.test(raw) ? 1 : 0);
    const leadDiff = lead(b.qtyRaw) - lead(a.qtyRaw);
    if (leadDiff) return leadDiff;
    return b.used - a.used;
  });
  return valid[0];
}

/** Lit un montant en partant de la fin : « 24 000 » (2 jetons) ou « 24000 » (1 jeton). */
function amountsFromEnd(tokens: DigitTok[], end: number): Array<{ value: number; start: number }> {
  const out: Array<{ value: number; start: number }> = [];
  if (end < 0) return out;
  out.push({ value: asInt(tokens[end].raw), start: end });
  if (end >= 1 && tokens[end].raw.length === 3 && tokens[end - 1].raw.length <= 3) {
    out.push({ value: joinThousands(tokens[end - 1].raw, tokens[end].raw), start: end - 1 });
  }
  return out;
}

/**
 * Ligne qui commence par la quantité : « 2 Savon Omo 1kg 1 250 2 500 ».
 * Quantité = premier nombre, total = dernier montant, prix unitaire = montant juste avant.
 */
function parseLeadingQtyRow(line: string): OCRItem | null {
  if (!/^\d{1,4}\s+[A-Za-zÀ-ÿ(]/.test(line)) return null;
  const tokens = digitTokens(line);
  const qty = asInt(tokens[0]?.raw ?? '');
  if (qty < 1 || tokens.length < 3) return null;

  let best: { unitPrice: number; total: number; puStart: number; score: number } | null = null;
  for (const total of amountsFromEnd(tokens, tokens.length - 1)) {
    for (const pu of amountsFromEnd(tokens, total.start - 1)) {
      if (pu.start < 1 || total.value < 50 || !nearlyEqual(qty * pu.value, total.value)) continue;
      const score = (total.start < tokens.length - 1 ? 1 : 0) + (pu.start < total.start - 1 ? 1 : 0);
      if (!best || score > best.score) best = { unitPrice: pu.value, total: total.value, puStart: pu.start, score };
    }
  }
  if (!best) return null;

  const name = stripLineNoise(line.slice(tokens[0].index + tokens[0].raw.length, tokens[best.puStart].index));
  if (name.length < 2 || looksLikeDateLine(name)) return null;
  const fixed = reconcileAmounts(qty, best.unitPrice, best.total);
  return {
    product_name: name.substring(0, 120),
    quantity: String(qty),
    unit: 'pièce',
    unit_price: String(fixed.unitPrice),
    total_price: String(fixed.total),
  };
}

function parseTableRow(line: string): OCRItem | null {
  const cleaned = line.replace(/[|│¦]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\btotal\b/i.test(cleaned) || (looksLikeDateLine(cleaned) && !parseTableAmounts(digitTokens(cleaned)))) return null;
  if (SKIP_ITEM.test(cleaned) && !parseTableAmounts(digitTokens(cleaned))) return null;

  const leading = parseLeadingQtyRow(cleaned);
  if (leading) return leading;

  const tokens = digitTokens(cleaned);
  const parsed = parseTableAmounts(tokens);
  if (!parsed) return null;

  const firstUsed = tokens[tokens.length - parsed.used];
  const name = stripLineNoise(cleaned.slice(0, firstUsed.index));
  if (name.length < 2) return null;
  if (looksLikeDateLine(name)) return null;

  const fixed = reconcileAmounts(parsed.qty, parsed.unitPrice, parsed.total);
  return {
    product_name: name.substring(0, 120),
    quantity: String(parsed.qty),
    unit: 'pièce',
    unit_price: String(fixed.unitPrice),
    total_price: String(fixed.total),
  };
}

function scoreSupplierLine(line: string, index: number): number {
  if (SKIP_SUPPLIER.test(line) || looksLikeGarbage(line) || looksLikeDateLine(line)) return -1;
  if (/attention/i.test(line)) return -1;
  if (CURRENCY.test(line)) return -1;
  if (line.length < 3 || line.length > 90) return -1;

  let score = Math.max(0, 12 - index);
  if (LEGAL_FORM.test(line)) score += 20;
  if (BUSINESS_KIND.test(line)) score += 16;
  const letters = (line.match(/[a-zA-ZàâéèêëïîôùûüçÀÂÉÈÊËÏÎÔÙÛÜÇ]/g) || []).length;
  const upper = (line.match(/[A-ZÀÂÉÈÊËÏÎÔÙÛÜÇ]/g) || []).length;
  if (letters >= 4 && upper / letters > 0.7) score += 10;
  if (/\d/.test(line)) score -= 6;
  const words = line.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.filter((w) => w.length >= 5).length === 0 && words.length >= 3) score -= 8;
  return score;
}

function pickSupplier(lines: string[]): string {
  let best = '';
  let bestScore = 0;
  const header = lines.slice(0, 15);
  header.forEach((line, index) => {
    const score = scoreSupplierLine(line, index);
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  });
  if (best) return cleanSupplierName(best);

  for (const line of header) {
    if (SKIP_SUPPLIER.test(line) || looksLikeDateLine(line) || looksLikeGarbage(line)) continue;
    if (/attention/i.test(line)) continue;
    if (CURRENCY.test(line)) continue;
    if (line.length >= 3) return cleanSupplierName(line);
  }
  return '';
}

function cleanSupplierName(name: string): string {
  return name.replace(/\s*à l['’]attention.*$/i, '').trim().substring(0, 200);
}

function lastMoneyAmount(line: string): number {
  const withoutPct = line.replace(/\(\s*\d{1,3}\s*%\s*\)/g, ' ').replace(/\d{1,3}\s*%/g, ' ');
  const matches = withoutPct.match(/\d{1,3}(?:[.\s]\d{3})+|\d+/g) || [];
  if (!matches.length) return 0;
  return parseFcfa(matches[matches.length - 1]);
}

function pickTotal(lines: string[]): number {
  const fromArrêté = (): number => {
    for (let ti = lines.length - 1; ti >= 0; ti--) {
      const line = lines[ti];
      const paren = line.match(/\((\d{1,3}(?:[.\s]\d{3})+)\)/);
      if (paren && /cfa|franc/i.test(line)) {
        const amt = parseFcfa(paren[1]);
        if (amt >= 100) return amt;
      }
    }
    return 0;
  };

  const fromLabeled = (allowSubtotal: boolean): number => {
    for (let ti = lines.length - 1; ti >= 0; ti--) {
      const line = lines[ti];
      if (/tva|taxe|tax\b/i.test(line) || /\d{1,3}\s*%/.test(line)) continue;
      const isSubtotal = /sous[-\s]?total|sub[-\s]?total/i.test(line);
      if (isSubtotal && !allowSubtotal) continue;
      if (!GRAND_TOTAL_LABEL.test(line) && !isSubtotal) continue;
      const amt = lastMoneyAmount(line);
      if (amt < 100 && lines[ti + 1]) {
        const next = lastMoneyAmount(lines[ti + 1]);
        if (next > 0) return next;
      }
      if (amt > 0) return amt;
    }
    return 0;
  };

  const arrêté = fromArrêté();
  if (arrêté) return arrêté;
  const grand = fromLabeled(false);
  if (grand) return grand;
  const sub = fromLabeled(true);
  if (sub) return sub;

  for (let fj = lines.length - 1; fj >= 0; fj--) {
    if (TAX_OR_SUBTOTAL.test(lines[fj])) continue;
    if (!CURRENCY.test(lines[fj])) continue;
    const val = lastMoneyAmount(lines[fj]);
    if (val >= 100) return val;
  }
  return 0;
}

function parseQtyPriceLine(line: string): OCRItem | null {
  const qtyItemPattern =
    /^(.{2,50}?)\s+(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:\s*[=:]?\s*(\d{1,3}(?:[.\s]\d{3})+|\d+))?\s*(?:FCFA|F|CFA)?\s*$/i;
  const qtyMatch = line.match(qtyItemPattern);
  if (!qtyMatch) return null;

  const qName = stripLineNoise(qtyMatch[1]);
  const qty = parseFcfa(qtyMatch[2]) || 1;
  const unitPrice = parseFcfa(qtyMatch[3]);
  const listedTotal = qtyMatch[4] ? parseFcfa(qtyMatch[4]) : 0;
  const total = listedTotal > 0 ? listedTotal : unitPrice * qty;
  if (!qName || total < 50) return null;
  if (looksLikeDateLine(qName) || MONTH_NAME.test(qName)) return null;
  const fixed = nearlyEqual(qty * unitPrice, total) ? reconcileAmounts(qty, unitPrice, total) : { unitPrice, total };

  return {
    product_name: qName.substring(0, 120),
    quantity: String(qty),
    unit: 'pièce',
    unit_price: String(fixed.unitPrice),
    total_price: String(fixed.total),
  };
}

function looksLikeCompleteItem(line: string): boolean {
  return Boolean(parseTableRow(line) || parseQtyPriceLine(line) || parseSimpleItem(line));
}

function hasTableAmounts(line: string): boolean {
  return Boolean(parseTableAmounts(digitTokens(line)));
}

function isBreakerLine(line: string): boolean {
  return (
    /^(total|montant|sous[-\s]?total|tva|arrêté|arrete|facture|date|merci)/i.test(line) ||
    GRAND_TOTAL_LABEL.test(line)
  );
}

/** Recolle les lignes OCR coupées (désignation d'un côté, Unité / montants de l'autre). */
function stitchOcrLines(lines: string[]): string[] {
  const cleaned = lines
    .map((l) => l.replace(/[|│¦]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const out: string[] = [];
  let buf = '';

  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };

  const startsNumberedRow = (line: string) => /^\d{1,3}[\s.]+[A-Za-zÀ-ÿ(]/.test(line);

  for (const line of cleaned) {
    if (isBreakerLine(line)) {
      flush();
      out.push(line);
      continue;
    }

    if (!buf) {
      buf = line;
      if (looksLikeCompleteItem(buf)) flush();
      continue;
    }

    const combined = `${buf} ${line}`;

    if (looksLikeCompleteItem(line)) {
      flush();
      out.push(line);
      continue;
    }

    if (looksLikeCompleteItem(combined)) {
      out.push(combined);
      buf = '';
      continue;
    }

    if (hasTableAmounts(line) && looksLikeCompleteItem(combined)) {
      out.push(combined);
      buf = '';
      continue;
    }

    if (startsNumberedRow(line)) {
      flush();
      buf = line;
      if (looksLikeCompleteItem(buf)) flush();
      continue;
    }

    buf = combined;
    if (looksLikeCompleteItem(buf)) flush();
  }
  flush();
  return out;
}

function parseSimpleItem(line: string): OCRItem | null {
  const itemPattern = /^(.{2,60}?)\s+(\d{1,3}(?:[.\s]\d{3})+|\d{2,})\s*(?:FCFA|F|CFA)?\s*$/i;
  const itemMatch = line.match(itemPattern);
  if (!itemMatch) return null;

  const iName = stripLineNoise(itemMatch[1]);
  const iTotal = parseFcfa(itemMatch[2]);
  if (iName.length < 2 || iTotal < 50) return null;
  if (looksLikeDateLine(line) || looksLikeDateLine(iName) || MONTH_NAME.test(iName)) return null;
  if (isLikelyYear(iTotal)) return null;
  if (digitTokens(iName).length >= 2) return null;
  if (/facture|re[cç]u|ticket/i.test(iName)) return null;
  if (LEGAL_FORM.test(iName) || LEGAL_FORM.test(line)) return null;

  return {
    product_name: iName.substring(0, 120),
    quantity: '1',
    unit: 'pièce',
    unit_price: String(iTotal),
    total_price: String(iTotal),
  };
}

export function parseReceiptText(rawText: string, avgConfidence = 0): OCRResult {
  const rawLines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => normalizeOcrLine(l.trim()).trim())
    .filter((l) => l.length > 0);

  const lines = stitchOcrLines(rawLines);
  const joined = rawLines.join('\n');
  const confidence = avgConfidence || 0;
  const invoiceDate = parseFrenchDate(joined) || todayISO();
  let totalAmount = pickTotal(lines);
  const supplierName = pickSupplier(rawLines);
  const items: OCRItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: OCRItem) => {
    const key = `${item.product_name.toLowerCase()}|${item.total_price}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  lines.forEach((line) => {
    if (/\btotal\b/i.test(line) && !parseTableAmounts(digitTokens(line))) return;
    if (SKIP_ITEM.test(line) && !parseTableAmounts(digitTokens(line))) return;
    if (SKIP_ITEM_BODY.test(line) && !parseTableAmounts(digitTokens(line))) return;
    if (looksLikeDateLine(line) && digitTokens(line).length <= 3) return;

    const tableItem = parseTableRow(line);
    if (tableItem) {
      pushItem(tableItem);
      return;
    }

    const qtyItem = parseQtyPriceLine(line);
    if (qtyItem) {
      pushItem(qtyItem);
      return;
    }

    const simple = parseSimpleItem(line);
    if (simple) pushItem(simple);
  });

  if (items.length === 0 && totalAmount > 0) {
    items.push({
      product_name: 'Article détecté (à compléter)',
      quantity: '1',
      unit: 'pièce',
      unit_price: String(totalAmount),
      total_price: String(totalAmount),
    });
  }

  if (items.length && totalAmount === 0) {
    totalAmount = items.reduce((sum, it) => sum + parseFcfa(it.total_price), 0);
  }

  return {
    provider: 'tesseract.js',
    raw_text: rawLines.join('\n'),
    confidence,
    supplier_name: supplierName,
    invoice_date: invoiceDate,
    total_amount: String(totalAmount),
    items: items.slice(0, 40),
  };
}
