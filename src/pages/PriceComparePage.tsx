import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getPriceEvolution, getTopProducts } from '../lib/invoices';
import type { TopProduct } from '../types/invoice';

export default function PriceComparePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [selected, setSelected] = useState('');
  const [period, setPeriod] = useState(3);
  const [evolution, setEvolution] = useState<{ month: string; avg_price: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    getTopProducts(user.id, 20).then((p) => {
      setProducts(p);
      if (p[0]) setSelected(p[0].product_name);
    });
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

  return (
    <AppLayout>
      <AppHeader title="Comparateur de prix" backTo="/" />

      <Card className="mb-4 space-y-3">
        <label className="block text-xs font-semibold text-[#6b7280]">Produit</label>
        <select
          className="w-full rounded-xl border border-[#e8ecf0] px-3 py-2 text-sm"
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
              className={`rounded-full px-3 py-1 text-xs font-semibold ${period === m ? 'bg-[#006d41] text-white' : 'bg-[#f4f6f8]'}`}
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
              <Line type="monotone" dataKey="avg_price" stroke="#006d41" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-[#6b7280]">
            Pas assez de données pour ce produit.
          </p>
        )}
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Card><p className="text-[#6b7280]">Min</p><p className="font-bold">{formatFcfa(priceMin)}</p></Card>
        <Card><p className="text-[#6b7280]">Max</p><p className="font-bold">{formatFcfa(priceMax)}</p></Card>
        <Card><p className="text-[#6b7280]">Var.</p><p className="font-bold">{competitivePct}%</p></Card>
      </div>

      <Link to="/stats/fournisseurs" className="text-sm font-semibold text-[#006d41]">
        Voir dépenses par fournisseur →
      </Link>
    </AppLayout>
  );
}
