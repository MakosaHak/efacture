import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronRight, ClipboardCheck, LineChart, ShoppingBag, Tags, TrendingUp } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { EmptyState, ListRow, Spinner } from '../components/ui/Feedback';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
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

export default function DashboardPage() {
  const { user, profile } = useAuth();
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
  }, [user]);

  const greeting = profile?.nom_commerce?.trim() || 'Bienvenue';
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
      <header className="mb-4 pt-2">
        <p className="text-[13px] text-muted">{profile?.quartier || 'Mon commerce'}</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-tight text-ink">{greeting}</h1>
      </header>

      <Card className="mb-3">
        <p className="text-[13px] text-muted">Dépensé en {monthLabel}</p>
        <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">
          {formatAmount(kpis.total_spent)} <span className="text-base font-semibold text-muted">FCFA</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <p className="text-xs text-muted">Aujourd’hui</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{formatFcfa(totals.day)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Cette semaine</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{formatFcfa(totals.week)}</p>
          </div>
        </div>
      </Card>

      <Link
        to="/scanner"
        className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-strong"
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
          <EmptyState
            icon={ShoppingBag}
            title="Aucun reçu validé"
            text="Scannez votre premier reçu : la photo et les montants seront enregistrés sur cet appareil."
          />
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
        <Card padding="none" className="divide-y divide-line">
          <Link to="/stats/prix" className="block px-4 py-3 hover:bg-surface-2">
            <ListRow icon={LineChart} title="Évolution des prix" subtitle="Par produit et par fournisseur" trailing={<ChevronRight size={18} className="text-faint" />} />
          </Link>
          <Link to="/stats/previsions" className="block px-4 py-3 hover:bg-surface-2">
            <ListRow
              icon={TrendingUp}
              title="Budget du mois prochain"
              subtitle={forecast ? `Environ ${formatFcfa(forecast.predicted_total)}` : 'Disponible après deux mois d’achats'}
              trailing={<ChevronRight size={18} className="text-faint" />}
            />
          </Link>
          <Link to="/stats/optimisation" className="block px-4 py-3 hover:bg-surface-2">
            <ListRow
              icon={ShoppingBag}
              title="Conseil d’achat"
              subtitle={
                optimization && optimization.potential_savings > 0
                  ? `Jusqu’à ${formatFcfa(optimization.potential_savings)} d’économies`
                  : 'Comparez vos fournisseurs'
              }
              trailing={<ChevronRight size={18} className="text-faint" />}
            />
          </Link>
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
                <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                  +{a.change_pct} %
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </AppLayout>
  );
}
