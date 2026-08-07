import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { useAuth } from '../context/AuthContext';
import {
  formatDate,
  formatFcfa,
  getMonthlyKpis,
  getMonthOverMonthChange,
  getPriceAlerts,
  getRecentPurchases,
} from '../lib/invoices';
import type { Invoice, PriceAlert } from '../types/invoice';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [kpis, setKpis] = useState({ total_spent: 0, invoice_count: 0, avg_amount: 0 });
  const [momChange, setMomChange] = useState(0);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMonthlyKpis(user.id),
      getMonthOverMonthChange(user.id),
      getRecentPurchases(user.id),
      getPriceAlerts(user.id),
    ]).then(([k, m, r, a]) => {
      setKpis(k);
      setMomChange(m);
      setRecent(r);
      setAlerts(a.slice(0, 5));
      setLoading(false);
    });
  }, [user]);

  const greeting = profile?.nom_commerce || user?.email?.split('@')[0] || 'Commerçant';
  const budgetEstimate = Math.max(kpis.total_spent * 1.5, 1);
  const budgetPct = Math.min(Math.round((kpis.total_spent / budgetEstimate) * 100), 100);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Bonjour {greeting.split(' ')[0]}</h1>
          {profile && <p className="text-sm text-[#6b7280]">{profile.nom_commerce}</p>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#006d41] text-lg font-bold text-white">
          {greeting.charAt(0).toUpperCase()}
        </div>
      </div>

      <Card className="mb-4 bg-gradient-to-br from-[#006d41] to-[#005533] text-white border-0">
        <p className="text-sm opacity-90">Dépenses du mois</p>
        <p className="text-3xl font-bold">{formatFcfa(kpis.total_spent)}</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>{momChange >= 0 ? '▲' : '▼'} {Math.abs(Math.round(momChange))}%</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-white" style={{ width: `${budgetPct}%` }} />
          </div>
          <span className="text-xs opacity-80">{budgetPct}% budget</span>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-[#6b7280]">Factures</p>
          <p className="text-2xl font-bold">{kpis.invoice_count}</p>
          <p className="text-xs text-[#9ca3af]">reçus</p>
        </Card>
        <Card className="bg-[#006d41] text-white border-0">
          <p className="text-xs opacity-90">Variation</p>
          <p className="text-2xl font-bold">{momChange >= 0 ? '+' : ''}{Math.round(momChange)}%</p>
        </Card>
      </div>

      <Link to="/scanner">
        <Button fullWidth className="mb-6">
          Scanner un reçu maintenant
        </Button>
      </Link>

      {alerts.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-bold text-orange-700">Alertes inflation</h2>
          {alerts.map((a) => (
            <Card key={a.product_name} className="mb-2 border-orange-200 bg-orange-50 py-2">
              <p className="text-sm font-medium">{a.product_name}</p>
              <p className="text-xs text-orange-800">+{a.change_pct}% sur 6 mois</p>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold">Derniers achats</h2>
      {recent.length === 0 ? (
        <Card className="text-center text-sm text-[#6b7280]">Aucun achat validé.</Card>
      ) : (
        recent.map((inv) => (
          <Link key={inv.id} to={`/factures/${inv.id}`}>
            <Card className="mb-2 flex items-center gap-3 py-3">
              <InvoiceThumbnail photoPath={inv.photo_path} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">{inv.supplier_name_raw || 'Sans fournisseur'}</p>
                <p className="text-xs text-[#6b7280]">{formatDate(inv.created_at)}</p>
              </div>
              <p className="text-sm font-bold text-[#006d41]">{formatFcfa(Number(inv.total_amount))}</p>
            </Card>
          </Link>
        ))
      )}
    </AppLayout>
  );
}
