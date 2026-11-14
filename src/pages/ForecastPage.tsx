import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Badge, EmptyState, Spinner } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { formatAmount, formatFcfa, getProductPriceForecasts, getSpendingForecast } from '../lib/invoices';
import type { ProductForecast, SpendingForecast } from '../types/invoice';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

function trendLabel(pct: number): string {
  if (pct > 0.5) return `en hausse (+${pct} % par mois)`;
  if (pct < -0.5) return `en baisse (${pct} % par mois)`;
  return 'stable';
}

export default function ForecastPage() {
  const { user } = useAuth();
  const [spend, setSpend] = useState<SpendingForecast | null>(null);
  const [products, setProducts] = useState<ProductForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getSpendingForecast(user.id), getProductPriceForecasts(user.id)]).then(([s, p]) => {
      setSpend(s);
      setProducts(p);
      setLoading(false);
    });
  }, [user]);

  const chartData = spend
    ? [
        ...spend.history.map((h) => ({ month: monthLabel(h.month), total: h.total })),
        { month: monthLabel(spend.predicted_month), total: spend.predicted_total, predicted: true },
      ]
    : [];

  return (
    <AppLayout>
      <AppHeader title="Budget du mois prochain" backTo="/" />

      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Estimation à partir de la moyenne de vos trois derniers mois, ajustée de l’évolution récente de vos prix d’achat.
      </p>

      {loading ? (
        <Spinner />
      ) : !spend ? (
        <EmptyState icon={TrendingUp} title="Pas encore de prévision" text="Il faut au moins deux mois de reçus validés pour estimer le mois prochain." />
      ) : (
        <>
          <Card className="mb-3">
            <p className="text-[13px] text-muted">Budget estimé</p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">
              {formatAmount(spend.predicted_total)} <span className="text-base font-semibold text-muted">FCFA</span>
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{spend.summary}</p>
          </Card>

          <Card className="mb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatFcfa(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13 }} />
                  <Line type="monotone" dataKey="total" name="Dépenses" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted">Le dernier point est l’estimation du mois prochain.</p>
          </Card>
        </>
      )}

      {!loading && (
        <>
          <SectionTitle>Prix attendus par produit</SectionTitle>
          {products.length === 0 ? (
            <Card className="text-[13px] text-muted">Pas assez d’historique par produit (deux mois minimum).</Card>
          ) : (
            <Card padding="none" className="divide-y divide-line">
              {products.map((p) => {
                const best = p.by_supplier[0];
                return (
                  <div key={p.product_name} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-medium text-ink">{p.product_name}</p>
                      <Badge tone={p.monthly_pct > 0.5 ? 'warning' : p.monthly_pct < -0.5 ? 'success' : 'neutral'}>{trendLabel(p.monthly_pct)}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      Attendu le mois prochain{best ? ` chez ${best.name}` : ''} : <strong className="text-ink">{formatFcfa(best?.predicted_price ?? p.predicted_price)}</strong> (aujourd’hui {formatFcfa(best?.last_price ?? p.last_price)}).
                    </p>
                    {p.by_supplier.length > 1 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {p.by_supplier.map((s) => (
                          <li key={s.name} className="text-xs text-muted">
                            {s.name} · {formatFcfa(s.predicted_price)} · {s.monthly_pct >= 0 ? '+' : ''}
                            {s.monthly_pct} % par mois
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          <Link to="/stats/optimisation" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Voir le conseil d’achat <ChevronRight size={16} />
          </Link>
        </>
      )}
    </AppLayout>
  );
}
