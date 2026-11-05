/** Coût de revient : facture + transport (taxi, keke, pousse-pousse), sans facture scannée. */

export function transportFeeOf(inv: {
  transport_fee?: number | null;
  ocr_raw_data?: { transport_fee?: number } | null;
}): number {
  const col = Number(inv.transport_fee);
  if (Number.isFinite(col) && col > 0) return col;
  if (Number.isFinite(col) && inv.transport_fee != null && col === 0) {
    const nested = Number(inv.ocr_raw_data?.transport_fee);
    return Number.isFinite(nested) && nested > 0 ? nested : 0;
  }
  const nested = Number(inv.ocr_raw_data?.transport_fee);
  return Number.isFinite(nested) ? Math.max(0, nested) : 0;
}

export function invoiceLandedTotal(inv: {
  total_amount: number;
  transport_fee?: number | null;
  ocr_raw_data?: { transport_fee?: number } | null;
}): number {
  return Math.max(0, Number(inv.total_amount) || 0) + transportFeeOf(inv);
}

export interface LandedLine {
  quantity: number;
  unit_price: number;
  total_price: number;
  transport_allocated: number;
  transport_per_unit: number;
  unit_landed_cost: number;
  line_landed_cost: number;
}

/**
 * Répartit le transport au prorata du montant de chaque ligne
 * (pour une seule ligne de N sacs : 2000 / N, comme dans le mémoire).
 */
export function allocateTransport(
  items: Array<{ quantity: number; unit_price: number; total_price: number }>,
  transportFee: number,
): LandedLine[] {
  const fee = Math.max(0, Number(transportFee) || 0);
  const normalized = items.map((it) => {
    const quantity = Math.max(0, Number(it.quantity) || 0);
    const unit_price = Number(it.unit_price) || 0;
    const total_price = Number(it.total_price) || quantity * unit_price;
    return { quantity, unit_price, total_price };
  });
  const valueSum = normalized.reduce((s, it) => s + it.total_price, 0);
  const qtySum = normalized.reduce((s, it) => s + it.quantity, 0);

  return normalized.map((it) => {
    const share =
      valueSum > 0 ? (it.total_price / valueSum) * fee : qtySum > 0 ? (it.quantity / qtySum) * fee : 0;
    const transport_per_unit = it.quantity > 0 ? share / it.quantity : 0;
    return {
      ...it,
      transport_allocated: share,
      transport_per_unit,
      unit_landed_cost: it.unit_price + transport_per_unit,
      line_landed_cost: it.total_price + share,
    };
  });
}
