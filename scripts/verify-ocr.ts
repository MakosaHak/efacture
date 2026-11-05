/**
 * Tests du parseur OCR réel (src/lib/ocr/ocr-parser.ts) sur plusieurs
 * formats de factures — pas un modèle entraîné sur un seul fournisseur.
 */
import assert from 'node:assert/strict';
import { parseFcfa, parseReceiptText } from '../src/lib/ocr/ocr-parser.ts';

assert.equal(parseFcfa('360.250'), 360250);
assert.equal(parseFcfa('13 500'), 13500);
assert.equal(parseFcfa('70 000'), 70000);
assert.equal(parseFcfa('33,500'), 33500);
assert.equal(parseFcfa('25000'), 25000);

const ticket = parseReceiptText(
  'Grossiste Adawlato\nDate 12/03/2025\nRiz 25kg 2 x 12500 = 25000\nHuile 5L 4 x 8500 = 34000\nTotal 59 000 FCFA',
);
assert.equal(ticket.supplier_name, 'Grossiste Adawlato');
assert.equal(ticket.invoice_date, '2025-03-12');
assert.equal(ticket.total_amount, '59000');
assert.equal(ticket.items.length, 2);
assert.equal(ticket.items[0].product_name.includes('Riz'), true);
assert.equal(ticket.items[1].total_price, '34000');

const pharmacie = parseReceiptText(
  'PHARMACIE DU CHATEAU\nLomé, le 03 janvier 2026\nParacétamol 1000  2  350  700\nSérum oral  5  200  1 000\nTOTAL TTC 1 700 F CFA',
);
assert.equal(pharmacie.supplier_name, 'PHARMACIE DU CHATEAU');
assert.equal(pharmacie.invoice_date, '2026-01-03');
assert.equal(pharmacie.total_amount, '1700');
assert.equal(pharmacie.items.length, 2);

const caisse = parseReceiptText(
  'Boutique Tokoin\n21/09/2026\nCoca 33cl 500 F\nPain 200 F\nTOTAL 700 FCFA',
);
assert.equal(caisse.supplier_name, 'Boutique Tokoin');
assert.equal(caisse.invoice_date, '2026-09-21');
assert.equal(caisse.total_amount, '700');
assert.equal(caisse.items.length, 2);

const tableInvoice = parseReceiptText(
  [
    'Th 7 TG SONTAQ OYNT TEA',
    'ALIMENTATION KOOM',
    'Kaya, le 28 décembre 2010',
    'FACTURE N°2010/198/KOOM-KAYA',
    '1 Cahiers de 200 pages Unité 200 350 70 000',
    '2 Cahiers de 100 pages Unité 850 225 191 250',
    '6 Bic rouge Unité 180 75 13 500',
    '7 Académie Unité 101 500 50 500',
    'TOTAL GENERAL 360 250',
    'Arrêté à la somme de (360.250) francs CFA',
  ].join('\n'),
);
assert.equal(tableInvoice.supplier_name, 'ALIMENTATION KOOM');
assert.equal(tableInvoice.invoice_date, '2010-12-28');
assert.equal(tableInvoice.total_amount, '360250');
assert.equal(tableInvoice.items.length, 4);
assert.equal(
  tableInvoice.items.some((it) => /kaya|décembre|decembre/i.test(it.product_name)),
  false,
);

const ets = parseReceiptText(
  'ETS FATIMA & FILS\nSARL au capital de 1 000 000\nDate 04/06/2024\nCiment 50kg 10 x 5 500 = 55 000\nMontant net à payer 55 000 FCFA',
);
assert.ok(/FATIMA/i.test(ets.supplier_name));
assert.equal(ets.invoice_date, '2024-06-04');
assert.equal(ets.total_amount, '55000');
assert.equal(ets.items.length, 1);

const service = parseReceiptText(
  [
    'FACTURE',
    'Facture n°12345',
    '06/01/25',
    'CÉLIA NAUDIN',
    "À L'ATTENTION DE",
    'Concordia',
    'Création de logo 900 01 900',
    "Conception d'un flyer 300 01 300",
    'Carte de visite 300 03 900',
    'Illustration personnalisée 200 04 800',
    'Refonte du site web 1500 01 1500',
    'Bannière publicitaire 250 01 250',
    'Sous total : 4 650 €',
    'TVA (20%) : 930 €',
    'TOTAL : 5 580 €',
  ].join('\n'),
);
assert.equal(service.supplier_name, 'CÉLIA NAUDIN');
assert.equal(service.invoice_date, '2025-01-06');
assert.equal(service.total_amount, '5580');
assert.notEqual(service.total_amount, '20930');
assert.equal(service.items.length, 6);
const logo = service.items.find((it) => /logo/i.test(it.product_name));
assert.ok(logo);
assert.equal(logo.quantity, '1');
assert.equal(logo.unit_price, '900');

const tvaOnly = parseReceiptText(
  'Boutique Centre\nDate 11/11/2025\nRiz 2 x 5000 = 10000\nTVA (20%) : 930 F\nSous total : 4 650 F',
);
assert.notEqual(tvaOnly.total_amount, '20930');
assert.equal(tvaOnly.total_amount, '4650');

const splitTable = parseReceiptText(
  [
    'ALIMENTATION KOOM',
    'Kaya, le 28 décembre 2010',
    '1 Cahiers de 200 pages Unité 200 350 70 000',
    '2 Cahiers de 100 pages',
    'Unité 850 225 191 250',
    '3 Cahiers de dessin Unité 50 100 5 000',
    '4 Cahiers double-ligne',
    'Unité 100 75 7 500',
    '5 Bic Bleu Unité 300 75 22 500',
    '6 Bic rouge Unité 180 75 13 500',
    '7 Académie',
    "(se trouve dans l'académie : 1compas, 1",
    'équerre, 1 rapporteur, 1 gomme)',
    'Unité 101 500 50 500',
    'TOTAL GENERAL 360 250',
  ].join('\n'),
);
assert.equal(splitTable.items.length, 7, `attendu 7 articles, reçu ${splitTable.items.length}: ${splitTable.items.map((i) => i.product_name).join(' | ')}`);
assert.equal(splitTable.items.some((it) => /cahiers de 100/i.test(it.product_name)), true);
assert.equal(splitTable.items.some((it) => /bic bleu/i.test(it.product_name)), true);
assert.equal(splitTable.items.some((it) => /acad/i.test(it.product_name)), true);
assert.equal(
  splitTable.items.every((it) => !/unité/i.test(it.product_name)),
  true,
);
assert.equal(splitTable.total_amount, '360250');

console.log('verify-ocr: OK (ticket, pharmacie, caisse, tableau, ETS, service/TVA, lignes coupées)');
