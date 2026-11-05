/**
 * Tests du calcul du prix de vente conseillé (src/lib/pricing.ts).
 */
import assert from 'node:assert/strict';
import {
  computeItemsPricing,
  invoiceTotalGap,
  priceIncreasePct,
  productKey,
  roundUpPrice,
  sellingPrice,
} from '../src/lib/pricing.ts';

// Arrondi au palier de 50 F supérieur (632 → 650)
assert.equal(roundUpPrice(632), 650);
assert.equal(roundUpPrice(650), 650);
assert.equal(roundUpPrice(651), 700);
assert.equal(roundUpPrice(0), 0);
assert.equal(roundUpPrice(-10), 0);
assert.equal(sellingPrice(550, 15), 650); // 632.5 → 650

// Exemple : facture 100 000 F, transport 5 000 F, marge 15 %
const lines = computeItemsPricing(
  [
    { quantity: 2, unit_price: 25000 }, // 50 000 → 50 % du transport
    { quantity: 10, unit_price: 5000 }, // 50 000 → 50 % du transport
  ],
  { invoiceTotal: 100000, transportFee: 5000, marginPct: 15 },
);
assert.equal(lines[0].sous_total, 50000);
assert.equal(lines[0].frais_transport_attribues, 2500);
assert.equal(lines[0].cout_de_revient_unitaire, 26250); // 25 000 + 2 500 / 2
assert.equal(lines[0].prix_de_vente_conseille, 30200); // 30 187.5 → 30 200
assert.equal(lines[1].cout_de_revient_unitaire, 5250); // 5 000 + 2 500 / 10
assert.equal(lines[1].prix_de_vente_conseille, 6050); // 6 037.5 → 6 050

// Sans transport : coût de revient = prix d'achat
const noTransport = computeItemsPricing([{ quantity: 3, unit_price: 1000 }], {
  invoiceTotal: 3000,
  transportFee: 0,
  marginPct: 20,
});
assert.equal(noTransport[0].cout_de_revient_unitaire, 1000);
assert.equal(noTransport[0].prix_de_vente_conseille, 1200);

// Montant facture illisible → base = somme des lignes
const noTotal = computeItemsPricing(
  [
    { quantity: 1, unit_price: 3000 },
    { quantity: 1, unit_price: 1000 },
  ],
  { invoiceTotal: 0, transportFee: 400, marginPct: 0 },
);
assert.equal(noTotal[0].frais_transport_attribues, 300);
assert.equal(noTotal[1].frais_transport_attribues, 100);

// Quantité nulle : pas de division par zéro
const zeroQty = computeItemsPricing([{ quantity: 0, unit_price: 500 }], {
  invoiceTotal: 1000,
  transportFee: 100,
  marginPct: 10,
});
assert.equal(zeroQty[0].cout_de_revient_unitaire, 500);

// Rapprochement produit + alerte de hausse
assert.equal(productKey('  Huile  Végétale 5L '), 'huile vegetale 5l');
assert.equal(priceIncreasePct(11000, 10000), 10);
assert.equal(priceIncreasePct(10600, 10000), 6);
assert.equal(priceIncreasePct(10500, 10000), null); // +5 % pile : ne dépasse pas le seuil
assert.equal(priceIncreasePct(10000, 10000), null);
assert.equal(priceIncreasePct(9000, 10000), null);
assert.equal(priceIncreasePct(10000, 0), null);

// Vérification croisée total IA / somme des lignes
assert.deepEqual(invoiceTotalGap(59000, [{ quantity: 2, unit_price: 12500 }, { quantity: 4, unit_price: 8500 }]), {
  linesSum: 59000,
  gap: 0,
  mismatch: false,
});
assert.equal(invoiceTotalGap(60000, [{ quantity: 2, unit_price: 12500 }]).gap, 35000);
assert.equal(invoiceTotalGap(60000, [{ quantity: 2, unit_price: 12500 }]).mismatch, true);
assert.equal(invoiceTotalGap(0, [{ quantity: 1, unit_price: 500 }]).mismatch, false); // total illisible
assert.equal(invoiceTotalGap(500, []).mismatch, false); // aucune ligne

console.log('verify-pricing: OK (prorata transport, coût de revient, PV arrondi 50 F, alerte > 5 %, écart total/lignes)');
