/** Modèles statistiques légers (BI / tendance). Pas de deep learning. */

export interface LinearFit {
  predicted: number;
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Taux de croissance mensuel composé entre le premier et le dernier point. */
export function monthlyGrowthRate(values: number[]): number | null {
  if (values.length < 2 || values[0] <= 0) return null;
  const last = values[values.length - 1];
  if (last <= 0) return null;
  return Math.pow(last / values[0], 1 / (values.length - 1)) - 1;
}

/** Régression linéaire (moindres carrés) et extrapolation au point suivant. */
export function fitLinearNext(values: number[]): LinearFit | null {
  const n = values.length;
  if (n < 2) return null;

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

  return { predicted, slope, intercept, r2, n };
}

export function slopeToMonthlyPct(slope: number, lastValue: number): number {
  if (lastValue <= 0) return 0;
  return (slope / lastValue) * 100;
}

export function nextMonthLabel(fromYm: string): string {
  const [y, m] = fromYm.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLong(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label;
}
