import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LineChart as LineIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getPriceEvolution, getSpendingBySupplier, getTopProducts } from '../lib/invoices';
import { displaySupplier } from '../lib/supplier';
import type { SupplierSpending, TopProduct } from '../types/invoice';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

export default function PriceComparePage() {
  const { user, dataVersion } = useAuth();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [selected, setSelected] = useState('');
  const [period, setPeriod] = useState(6);
  const [evolution, setEvolution] = useState<{ month: string; avg_price: number }[]>([]);
  const [spending, setSpending] = useState<SupplierSpending[]>([]);

  useEffect(() => {
    if (!user) return;
    getTopProducts(user.id, 20).then((p) => {
      setProducts(p);
      if (p[0]) setSelected(p[0].product_name);
    });
    getSpendingBySupplier(user.id).then(setSpending);
  }, [user, dataVersion]);

  useEffect(() => {
    if (!user || !selected) return;
    getPriceEvolution(user.id, selected, period).then(setEvolution);
  }, [user, selected, period]);

  const prices = evolution.map((e) => e.avg_price);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const variation = prices.length >= 2 && prices[0] > 0 ? Math.round(((prices[prices.length - 1] - prices[0]) / prices[0]) * 1000) / 10 : 0;
  const maxTotal = spending[0]?.total || 1;
  const chartData = evolution.map((e) => ({ ...e, label: monthLabel(e.month) }));

  return (
    <AppLayout>
      <AppHeader title="Évolution des prix" backTo="/" />

      {products.length === 0 ? (
        <EmptyState icon={LineIcon} title="Pas encore d’historique" text="Validez quelques reçus avec des articles pour suivre l’évolution de leurs prix." />
      ) : (
        <>
          <Card className="mb-3 space-y-3">
            <Select label="Produit" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {products.map((p) => (
                <option key={p.product_name} value={p.product_name}>
                  {p.product_name}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              {[3, 6, 12].map((m) => {
                const active = period === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPeriod(m)}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2'}`}
                    aria-pressed={active}
                  >
                    {m} mois
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="mb-3">
            {chartData.length > 1 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#eef0f3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => v.toLocaleString('fr-FR')} />
                    <Tooltip formatter={(v: number) => formatFcfa(v)} labelStyle={{ color: '#111827', fontWeight: 600 }} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13 }} />
                    <Line type="monotone" dataKey="avg_price" name="Prix moyen" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-[13px] text-muted">Un seul mois d’achat pour ce produit : la courbe apparaîtra au mois suivant.</p>
            )}
            <div className="mt-3 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
              <div>
                <p className="text-xs text-muted">Minimum</p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink">{formatFcfa(priceMin)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Maximum</p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink">{formatFcfa(priceMax)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Variation</p>
                <p className={`mt-0.5 text-[15px] font-semibold ${variation > 0 ? 'text-warning' : variation < 0 ? 'text-success' : 'text-ink'}`}>
                  {variation > 0 ? '+' : ''}
                  {variation} %
                </p>
              </div>
            </div>
          </Card>

          <SectionTitle
            action={
              <Link to="/stats/fournisseurs" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary">
                Détail <ChevronRight size={16} />
              </Link>
            }
          >
            Dépenses par fournisseur
          </SectionTitle>
          <p className="-mt-1 mb-2 text-xs text-muted">3 derniers mois</p>

          {spending.length === 0 ? (
            <Card className="text-center text-[13px] text-muted">Aucune donnée.</Card>
          ) : (
            <Card padding="none" className="divide-y divide-line">
              {spending.map((s) => (
                <div key={s.supplier_name_raw} className="px-4 py-3">
                  <div className="mb-2 flex justify-between gap-2 text-[15px]">
                    <span className="truncate font-medium text-ink">{displaySupplier(s.supplier_name_raw)}</span>
                    <span className="shrink-0 font-semibold text-ink">{formatFcfa(s.total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(s.total / maxTotal) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {s.count} reçu{s.count > 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </AppLayout>
  );
}
