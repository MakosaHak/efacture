import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronRight, ClipboardCheck, LineChart, ShoppingBag, Tags, TrendingUp, Wallet } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { EmptyState, ListRow, Spinner } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Avatar';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { AnalysisWheel } from '../components/dashboard/AnalysisWheel';
import { useAuth } from '../context/AuthContext';
import {
  formatAmount,
  formatDate,
  formatFcfa,
  getMonthlyKpis,
  getPendingInvoices,
  getPriceAlerts,
  getRecentPurchases,
  getSpendingForecast,
  getSpendingTotals,
  getFinancialOptimization,
} from '../lib/invoices';
import { invoiceLandedTotal } from '../lib/landed-cost';
import { countPendingSuggestions } from '../lib/productPrices';
import type { Invoice, PriceAlert, SpendingForecast, FinancialOptimization, SpendingTotals } from '../types/invoice';
import { displaySupplier } from '../lib/supplier';

function greetingWord(): string {
  const h = new Date().getHours();
  return h < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function DashboardPage() {
  const { user, profile, dataVersion } = useAuth();
  const [kpis, setKpis] = useState({ total_spent: 0, invoice_count: 0, avg_amount: 0 });
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [pending, setPending] = useState<Invoice[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [forecast, setForecast] = useState<SpendingForecast | null>(null);
  const [optimization, setOptimization] = useState<FinancialOptimization | null>(null);
  const [totals, setTotals] = useState<SpendingTotals>({ day: 0, week: 0, month: 0 });
  const [pendingPrices, setPendingPrices] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      getMonthlyKpis(user.id),
      getRecentPurchases(user.id, 4),
      getPendingInvoices(user.id),
      getPriceAlerts(user.id),
      getSpendingForecast(user.id),
      getFinancialOptimization(user.id),
      getSpendingTotals(user.id),
      countPendingSuggestions(user.id).catch(() => 0),
    ]).then(([k, r, p, a, f, o, t, pp]) => {
      if (cancelled) return;
      setKpis(k);
      setRecent(r);
      setPending(p);
      setAlerts(a.slice(0, 3));
      setForecast(f);
      setOptimization(o);
      setTotals(t);
      setPendingPrices(pp);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, dataVersion]);

  const shopName = profile?.nom_commerce?.trim() || 'Mon commerce';
  const firstName = (profile?.nom_personne || '').trim().split(/\s+/)[0] || '';
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long' });

  if (loading) {
    return (
      <AppLayout>
        <Spinner />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="mb-4 flex items-center gap-3 pt-2">
        <Link to="/profil" aria-label="Mon compte">
          <Avatar path={profile?.avatar_path} name={firstName || shopName} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold leading-tight text-ink">
            {greetingWord()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="truncate text-[13px] text-muted">{shopName}</p>
        </div>
      </header>

      <section className="mb-3 rounded-card bg-primary p-4 text-white shadow-card">
        <div className="flex items-center gap-2 text-[13px] text-white/80">
          <Wallet size={16} />
          Dépensé en {monthLabel}
        </div>
        <p className="mt-2 text-[32px] font-bold leading-none tracking-tight">
          {formatAmount(kpis.total_spent)} <span className="text-base font-semibold text-white/80">FCFA</span>
        </p>
        <p className="mt-1 text-[13px] text-white/80">
          {kpis.invoice_count} reçu{kpis.invoice_count > 1 ? 's' : ''} validé{kpis.invoice_count > 1 ? 's' : ''}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-white/12 px-3 py-2">
            <p className="text-xs text-white/75">Aujourd’hui</p>
            <p className="mt-0.5 text-[15px] font-semibold">{formatFcfa(totals.day)}</p>
          </div>
          <div className="rounded-[12px] bg-white/12 px-3 py-2">
            <p className="text-xs text-white/75">Cette semaine</p>
            <p className="mt-0.5 text-[15px] font-semibold">{formatFcfa(totals.week)}</p>
          </div>
        </div>
      </section>

      <Link
        to="/scanner"
        className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-control border border-primary/20 bg-primary-soft text-[15px] font-semibold text-primary-ink transition-colors hover:bg-primary/15"
      >
        <Camera size={20} />
        Scanner un reçu
      </Link>

      {(pending.length > 0 || pendingPrices > 0) && (
        <Card padding="none" className="mb-4 divide-y divide-line">
          {pending.length > 0 && (
            <Link to="/factures?status=pending" className="block px-4 py-3 hover:bg-surface-2">
              <ListRow
                icon={ClipboardCheck}
                tone="amber"
                title={`${pending.length} reçu${pending.length > 1 ? 's' : ''} à vérifier`}
                subtitle="Confirmez les montants lus sur la photo"
                trailing={<ChevronRight size={18} className="text-faint" />}
              />
            </Link>
          )}
          {pendingPrices > 0 && (
            <Link to="/prix-de-vente" className="block px-4 py-3 hover:bg-surface-2">
              <ListRow
                icon={Tags}
                tone="green"
                title={`${pendingPrices} prix de vente à confirmer`}
                subtitle="Suggestions d’après vos derniers achats"
                trailing={<ChevronRight size={18} className="text-faint" />}
              />
            </Link>
          )}
        </Card>
      )}

      <section className="mb-5">
        <SectionTitle
          action={
            <Link to="/factures" className="text-[13px] font-semibold text-primary">
              Voir tout
            </Link>
          }
        >
          Derniers achats
        </SectionTitle>
        {recent.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Aucun reçu validé" text="Scannez votre premier reçu : la photo et les montants seront enregistrés sur cet appareil." />
        ) : (
          <Card padding="none" className="divide-y divide-line">
            {recent.map((inv) => (
              <Link key={inv.id} to={`/factures/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <InvoiceThumbnail photoPath={inv.photo_path} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{displaySupplier(inv.supplier_name_raw)}</p>
                  <p className="text-[13px] text-muted">{formatDate(inv.invoice_date || inv.created_at)}</p>
                </div>
                <span className="text-[15px] font-semibold text-ink">{formatFcfa(invoiceLandedTotal(inv))}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section className="mb-5">
        <SectionTitle>Analyses</SectionTitle>
        <Card className="py-5">
          <AnalysisWheel
            items={[
              { to: '/stats/prix', label: 'Évolution des prix', icon: LineChart, fill: '#eff4ff', ink: '#1e3a8a' },
              {
                to: '/stats/previsions',
                label: 'Budget du mois prochain',
                icon: TrendingUp,
                fill: '#f1ecfb',
                ink: '#5b21b6',
                value: forecast ? `≈ ${formatAmount(forecast.predicted_total)} F` : undefined,
              },
              {
                to: '/stats/optimisation',
                label: 'Conseil d’achat',
                icon: ShoppingBag,
                fill: '#e6f6f4',
                ink: '#0f766e',
                value: optimization && optimization.potential_savings > 0 ? `${formatAmount(optimization.potential_savings)} F à gagner` : undefined,
              },
            ]}
          />
        </Card>
      </section>

      {alerts.length > 0 && (
        <section className="mb-2">
          <SectionTitle>Prix en hausse</SectionTitle>
          <Card padding="none" className="divide-y divide-line">
            {alerts.map((a) => (
              <div key={a.product_name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{a.product_name}</p>
                  <p className="text-[13px] text-muted">
                    {formatFcfa(a.first_price)} puis {formatFcfa(a.last_price)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-rose-soft px-2 py-0.5 text-xs font-semibold text-rose">+{a.change_pct} %</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </AppLayout>
  );
}
