import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getPriceEvolution, getSpendingBySupplier, getTopProducts } from '../lib/invoices';
import { displaySupplier } from '../lib/supplier';
import type { SupplierSpending, TopProduct } from '../types/invoice';

export default function PriceComparePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [selected, setSelected] = useState('');
  const [period, setPeriod] = useState(3);
  const [evolution, setEvolution] = useState<{ month: string; avg_price: number }[]>([]);
  const [spending, setSpending] = useState<SupplierSpending[]>([]);

  useEffect(() => {
    if (!user) return;
    getTopProducts(user.id, 20).then((p) => {
      setProducts(p);
      if (p[0]) setSelected(p[0].product_name);
    });
    getSpendingBySupplier(user.id).then(setSpending);
  }, [user]);

  useEffect(() => {
    if (!user || !selected) return;
    getPriceEvolution(user.id, selected, period).then(setEvolution);
  }, [user, selected, period]);

  const prices = evolution.map((e) => e.avg_price);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const competitivePct =
    prices.length >= 2 && prices[0] > 0
      ? Math.round(((prices[prices.length - 1] - prices[0]) / prices[0]) * 1000) / 10
      : 0;
  const maxTotal = spending[0]?.total || 1;

  return (
    <AppLayout>
      <AppHeader title="Prix" backTo="/" />

      <Card className="mb-4 space-y-3">
        <label className="block text-xs font-semibold text-[#64748B]">Produit</label>
        <select
          className="w-full rounded-xl border border-white/80 bg-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] shadow-neo-inset outline-none"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.product_name} value={p.product_name}>
              {p.product_name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {[1, 3].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPeriod(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${period === m ? 'bg-[#1E3A8A] text-white shadow-sm' : 'border border-white/70 bg-[#E2E8F0] text-[#64748B] shadow-neo-inset'}`}
            >
              {m} mois
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 h-56">
        {evolution.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatFcfa(v)} />
              <Line type="monotone" dataKey="avg_price" stroke="#2563EB" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-[#64748B]">
            Pas assez de données pour ce produit.
          </p>
        )}
      </Card>

      <div className="mb-5 grid grid-cols-3 gap-2 text-center text-xs">
        <Card><p className="text-[#64748B]">Min</p><p className="font-bold">{formatFcfa(priceMin)}</p></Card>
        <Card><p className="text-[#64748B]">Max</p><p className="font-bold">{formatFcfa(priceMax)}</p></Card>
        <Card><p className="text-[#64748B]">Var.</p><p className="font-bold">{competitivePct}%</p></Card>
      </div>

      <div className="mb-3 flex items-baseline gap-2 px-0.5">
        <h2 className="text-sm font-bold tracking-tight text-[#0F172A]">Dépenses par fournisseur</h2>
        <span className="font-editorial text-[11px] italic text-[#64748B]">3 derniers mois</span>
      </div>

      {spending.length === 0 ? (
        <Card className="text-center text-sm text-[#64748B]">Aucune donnée.</Card>
      ) : (
        spending.map((s) => (
          <Card key={s.supplier_name_raw} className="mb-3">
            <div className="mb-2 flex justify-between gap-2 text-sm">
              <span className="font-semibold text-[#0F172A]">{displaySupplier(s.supplier_name_raw)}</span>
              <span className="font-display font-bold text-[#1E3A8A]">{formatFcfa(s.total)}</span>
            </div>
            <div className="mb-1 h-2 overflow-hidden rounded-full bg-[#CBD5E1] shadow-neo-inset">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4]"
                style={{ width: `${(s.total / maxTotal) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[#94A3B8]">{s.count} facture{s.count > 1 ? 's' : ''}</p>
          </Card>
        ))
      )}
    </AppLayout>
  );
}
