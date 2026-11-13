import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getProductPriceForecasts, getSpendingForecast } from '../lib/invoices';
import type { ProductForecast, SpendingForecast } from '../types/invoice';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

function trendLabel(pct: number): string {
  if (pct > 0.5) return `tendance à la hausse (+${pct} %/mois)`;
  if (pct < -0.5) return `tendance à la baisse (${pct} %/mois)`;
  return 'prix stables';
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
        ...spend.history.map((h) => ({ month: monthLabel(h.month), total: h.total, type: 'observé' })),
        {
          month: monthLabel(spend.predicted_month),
          total: spend.predicted_total,
          type: 'prévu',
        },
      ]
    : [];

  return (
    <AppLayout>
      <AppHeader title="Mois prochain" backTo="/" />

      <p className="mb-4 text-xs leading-relaxed text-[#64748B]">
        Informatique décisionnelle : moyenne des 3 derniers mois, ajustée du taux d’inflation moyen détecté
        sur vos prix unitaires. Les prix produits sont extrapolés par régression linéaire (moindres carrés).
        Ce n’est pas un modèle de deep learning.
      </p>

      {loading ? (
        <Card className="text-center text-sm text-[#64748B]">Calcul…</Card>
      ) : !spend ? (
        <Card className="text-sm text-[#64748B]">
          Au moins deux mois de factures validées sont nécessaires pour une prévision.
        </Card>
      ) : (
        <>
          <Card className="relative mb-4 overflow-hidden border-blue-400/20 bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0F172A] text-white shadow-sapphire-depth">
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#06B6D4]/25 to-[#10B981]/15 blur-2xl" />
            <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[#06B6D4] via-[#38BDF8] to-[#10B981]" />
            <p className="text-sm opacity-90">Prévision trésorerie</p>
            <p className="text-3xl font-bold">{formatFcfa(spend.predicted_total)}</p>
            <p className="mt-2 text-xs leading-relaxed opacity-90">{spend.summary}</p>
          </Card>

          <Card className="mb-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip formatter={(v: number) => formatFcfa(v)} />
                <Line type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      <h2 className="mb-2 text-sm font-bold">Projection des prix</h2>
      {products.length === 0 ? (
        <Card className="text-sm text-[#64748B]">Pas assez d’historique produit (minimum 2 mois).</Card>
      ) : (
        products.map((p) => {
          const best = p.by_supplier[0];
          return (
            <Card key={p.product_name} className="mb-2">
              <p className="text-sm font-semibold">{p.product_name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                Le prix suit une {trendLabel(p.monthly_pct)}. Prix prédit le mois prochain
                {best ? ` chez ${best.name}` : ''} : {formatFcfa(best?.predicted_price ?? p.predicted_price)}{' '}
                (vs {formatFcfa(best?.last_price ?? p.last_price)} aujourd’hui).
              </p>
              {p.by_supplier.length > 1 && (
                <div className="mt-2 space-y-0.5">
                  {p.by_supplier.map((s) => (
                    <p key={s.name} className="text-xs text-[#94A3B8]">
                      {s.name} · prévu {formatFcfa(s.predicted_price)} · {s.monthly_pct >= 0 ? '+' : ''}
                      {s.monthly_pct} %/mois
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}

      <Link to="/stats/optimisation" className="mt-4 block text-sm font-semibold text-[#1E3A8A]">
        Recommandation d’approvisionnement →
      </Link>
    </AppLayout>
  );
}

