/**
 * Contrôle des règles critiques d'efacture (parser, téléphone, KPI, alerte, régression).
 * Miroir volontaire de src/lib/auth/phone-auth.ts, src/lib/predict.ts,
 * src/lib/ocr/ocr-parser.ts et src/lib/invoices.ts — pas une mesure OCR sur photo.
 */
import assert from 'node:assert/strict';
// Module réel (TypeScript pur) : script lancé avec --experimental-strip-types (cf. package.json).
import {
  averagePurchasePrices,
  invoiceTotalGap,
  isPriceIncrease,
  learnMargin,
  normalizeProductName,
  roundToStep,
  suggestSellingPrice,
} from '../src/lib/pricing.ts';

function normalizePhoneDigits(raw) {
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('228')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

function validateTogoPhone(raw) {
  return /^[79]\d{7}$/.test(normalizePhoneDigits(raw));
}

function toDecimal(value) {
  let s = String(value || '').trim();
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
    if (parts[parts.length - 1].length === 3) s = parts.join('');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function parseFrenchDate(text) {
  const months = {
    janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
    mai: '05', juin: '06', juillet: '07', aout: '08', août: '08',
    septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
  };
  const written = text.match(
    /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
  );
  if (written) {
    const month = months[written[2].toLowerCase()];
    if (month) return `${written[3]}-${month}-${written[1].padStart(2, '0')}`;
  }
  const numeric = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  return '';
}

function parseReceiptText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const joined = lines.join('\n');
  let supplierName = '';
  let invoiceDate = parseFrenchDate(joined);
  let totalAmount = 0;
  const totalPattern = /(?:total\s*(?:g[ée]n[ée]ral(?:e)?|ttc|ht)?|montant|net|payer|ttc).{0,40}?([\d\s.]+)/i;
  const skipSupplier = /^(facture|reçu|recu|ticket|date|total|montant|merci|tel|tél|phone|n°|no|doit)/i;
  const supplierHint = /alimentation|etablissement|établissement|grossiste|boutique|pharmacie|commerce|magasin|ets|sarl/i;

  for (let ti = lines.length - 1; ti >= 0; ti--) {
    const paren = lines[ti].match(/\((\d{1,3}(?:[.\s]\d{3})+)\)/);
    if (paren && /cfa|franc/i.test(lines[ti])) {
      const amt = toDecimal(paren[1]);
      if (amt >= 100) {
        totalAmount = amt;
        break;
      }
    }
    const totalMatch = lines[ti].match(totalPattern);
    if (totalMatch) {
      const amt = toDecimal(totalMatch[1]);
      if (amt > 0) {
        totalAmount = amt;
        break;
      }
    }
  }

  const hinted = lines.find((line) => supplierHint.test(line) && !skipSupplier.test(line));
  if (hinted) {
    supplierName = hinted.substring(0, 200);
  } else {
    for (let si = 0; si < lines.length; si++) {
      const line = lines[si];
      if (skipSupplier.test(line) || /\d{2}[/.-]\d{2}/.test(line)) continue;
      if (line.length >= 3 && !supplierName) {
        supplierName = line.substring(0, 200);
        break;
      }
    }
  }

  return { supplierName, invoiceDate, totalAmount };
}

function monthVariation(cur, prev) {
  if (prev <= 0) return cur <= 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function priceAlert(first, last, threshold = 10) {
  if (first <= 0) return null;
  const change = ((last - first) / first) * 100;
  return change >= threshold ? Math.round(change * 10) / 10 : null;
}

function fitLinearNext(values) {
  const n = values.length;
  if (n < 3) return null;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  const predicted = Math.max(0, intercept + slope * n);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i];
    ssRes += (values[i] - yhat) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot <= 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { predicted, slope, r2, n };
}

assert.equal(validateTogoPhone('90 12 34 56'), true);
assert.equal(validateTogoPhone('+22890123456'), true);
assert.equal(validateTogoPhone('61234567'), false);
assert.equal(validateTogoPhone('80123456'), false);

const parsed = parseReceiptText(
  'Grossiste Adawlato\nDate 12/03/2025\nRiz 25000 F\nTotal 33 500 FCFA',
);
assert.equal(parsed.supplierName, 'Grossiste Adawlato');
assert.equal(parsed.invoiceDate, '2025-03-12');
assert.equal(parsed.totalAmount, 33500);

assert.equal(toDecimal('360.250'), 360250);
assert.equal(toDecimal('13 500'), 13500);
assert.equal(toDecimal('70 000'), 70000);

const koom = parseReceiptText(
  'Th 7 TG SONTAQ OYNT TEA\nALIMENTATION KOOM\nKaya, le 28 décembre 2010\nFACTURE N°2010/198/KOOM-KAYA\n1 Cahiers de 200 pages Unité 200 350 70 000\nTOTAL GENERAL 360 250\nArrêté à la somme de (360.250) francs CFA',
);
assert.equal(koom.supplierName, 'ALIMENTATION KOOM');
assert.equal(koom.invoiceDate, '2010-12-28');
assert.equal(koom.totalAmount, 360250);

assert.equal(monthVariation(120, 100), 20);
assert.equal(monthVariation(50, 0), 100);
assert.equal(monthVariation(0, 0), 0);

assert.equal(priceAlert(10000, 11000, 10), 10);
assert.equal(priceAlert(10000, 10500, 10), null);

const fit = fitLinearNext([10, 20, 30]);
assert.ok(fit);
assert.equal(fit.predicted, 40);
assert.equal(fit.r2, 1);
assert.equal(fitLinearNext([10, 20]), null);

// Prix de vente suggérés (src/lib/pricing.ts)
assert.equal(suggestSellingPrice(20000, 0.15), 23000);
assert.equal(suggestSellingPrice(22000, 0.15), 25300);
assert.equal(roundToStep(1237), 1225);
assert.equal(roundToStep(1238), 1250);
assert.equal(roundToStep(0), 0);
assert.equal(learnMargin(0.15, 20000, 24000), 0.165); // marge réelle 0.20
assert.equal(learnMargin(0.15, 20000, 19000), 0.15); // sous le coût : marge inchangée
assert.equal(learnMargin(0.15, 0, 5000), 0.15); // prix d'achat inconnu
assert.equal(learnMargin(0.9, 1000, 5000), 1); // bornée à 100 %
assert.equal(learnMargin(0.15, 1000, 1000), 0.105); // revente au prix coûtant
assert.equal(normalizeProductName('Riz parfumé 25kg'), normalizeProductName('riz  parfume 25 kg'));
assert.equal(normalizeProductName('Huile végétale (5L)'), 'huile vegetale 5 l');
assert.equal(isPriceIncrease(11100, 10000), true);
assert.equal(isPriceIncrease(11000, 10000), false); // +10 % pile : pas au-delà du seuil
assert.equal(isPriceIncrease(11100, null), false); // produit nouveau
const avg = averagePurchasePrices([
  { product_name: 'Sucre 1kg', quantity: 2, unit_price: 700 },
  { product_name: 'sucre 1 kg', quantity: 2, unit_price: 800 },
  { product_name: 'Huile 5L', quantity: 1, unit_price: 4500 },
]);
assert.equal(avg.length, 2);
assert.equal(avg.find((p) => p.product_key === 'sucre 1 kg').unit_price, 750);
assert.equal(invoiceTotalGap(60000, [{ quantity: 2, unit_price: 12500 }]).gap, 35000);
assert.equal(invoiceTotalGap(25000, [{ quantity: 2, unit_price: 12500 }]).mismatch, false);

console.log('verify-rules: OK (téléphone, parser FCFA/date, KPI, alerte 10 %, régression, prix de vente suggérés)');
