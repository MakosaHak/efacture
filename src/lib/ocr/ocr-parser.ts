import type { OCRItem, OCRResult } from '../../types/invoice';

function toDecimal(value: string | number | undefined): number {
  let cleaned = String(value || '')
    .replace(/\s/g, '')
    .replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseReceiptText(rawText: string, avgConfidence = 0): OCRResult {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let supplierName = '';
  let invoiceDate = todayISO();
  let totalAmount = 0;
  const items: OCRItem[] = [];
  const confidence = avgConfidence || 0;

  const datePatterns = [/(\d{2})[/.-](\d{2})[/.-](\d{4})/, /(\d{4})[/.-](\d{2})[/.-](\d{2})/];
  const totalPattern = /(?:total|montant|net|payer|ttc).{0,30}?([\d\s.,]+)\s*(?:FCFA|F|CFA)?/i;
  const itemPattern = /^(.{2,60}?)\s+(\d+(?:[.,]\d+)?)\s*(?:FCFA|F|CFA)?\s*$/i;
  const qtyItemPattern = /^(.{2,50}?)\s+(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:FCFA|F|CFA)?\s*$/i;
  const skipSupplier = /^(facture|reçu|recu|ticket|date|total|montant|merci|tel|tél|phone|n°|no)/i;

  lines.forEach((line) => {
    datePatterns.forEach((pattern) => {
      const match = line.match(pattern);
      if (!match) return;
      if (match[1].length === 4) {
        invoiceDate = `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        invoiceDate = `${match[3]}-${match[2]}-${match[1]}`;
      }
    });
  });

  for (let ti = lines.length - 1; ti >= 0; ti--) {
    const totalMatch = lines[ti].match(totalPattern);
    if (totalMatch) {
      const amt = toDecimal(totalMatch[1]);
      if (amt > 0) {
        totalAmount = amt;
        break;
      }
    }
  }

  if (totalAmount === 0) {
    for (let fj = lines.length - 1; fj >= 0; fj--) {
      if (/(?:FCFA|CFA|\bF\b)/i.test(lines[fj])) {
        const nums = lines[fj].match(/[\d\s.,]+/g) || [];
        for (let nk = nums.length - 1; nk >= 0; nk--) {
          const val = toDecimal(nums[nk]);
          if (val >= 100) {
            totalAmount = val;
            break;
          }
        }
      }
      if (totalAmount > 0) break;
    }
  }

  for (let si = 0; si < lines.length; si++) {
    if (skipSupplier.test(lines[si]) || /\d{2}[/.-]\d{2}/.test(lines[si])) continue;
    if (lines[si].length >= 3 && !supplierName) {
      supplierName = lines[si].substring(0, 200);
      break;
    }
  }

  lines.forEach((line) => {
    if (totalPattern.test(line) || skipSupplier.test(line)) return;

    const qtyMatch = line.match(qtyItemPattern);
    if (qtyMatch) {
      const qName = qtyMatch[1].replace(/^[\s\-•|]+|[\s\-•|]+$/g, '');
      const qty = toDecimal(qtyMatch[2]) || 1;
      const qTotal = toDecimal(qtyMatch[3]);
      if (qName && qTotal > 0) {
        items.push({
          product_name: qName,
          quantity: String(qty),
          unit: 'pièce',
          unit_price: String(qTotal / qty),
          total_price: String(qTotal),
        });
      }
      return;
    }

    const itemMatch = line.match(itemPattern);
    if (itemMatch) {
      const iName = itemMatch[1].replace(/^[\s\-•|]+|[\s\-•|]+$/g, '');
      const iTotal = toDecimal(itemMatch[2]);
      if (iName.length >= 2 && iTotal >= 50) {
        items.push({
          product_name: iName,
          quantity: '1',
          unit: 'pièce',
          unit_price: String(iTotal),
          total_price: String(iTotal),
        });
      }
    }
  });

  if (items.length === 0 && totalAmount > 0 && supplierName) {
    items.push({
      product_name: 'Article détecté (à compléter)',
      quantity: '1',
      unit: 'pièce',
      unit_price: String(totalAmount),
      total_price: String(totalAmount),
    });
  }

  if (items.length && totalAmount === 0) {
    totalAmount = items.reduce((sum, it) => sum + toDecimal(it.total_price), 0);
  }

  return {
    provider: 'tesseract.js',
    raw_text: lines.join('\n'),
    confidence,
    supplier_name: supplierName,
    invoice_date: invoiceDate,
    total_amount: String(totalAmount),
    items: items.slice(0, 25),
  };
}
