import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { useAuth } from '../context/AuthContext';
import {
  formatDate,
  formatFcfa,
  getMonthlyKpis,
  getMonthOverMonthChange,
  getPriceAlerts,
  getRecentPurchases,
  getSpendingForecast,
  getSpendingTotals,
  getFinancialOptimization,
  getOfflineQueueCount,
} from '../lib/invoices';
import { invoiceLandedTotal } from '../lib/landed-cost';
import { countPendingSuggestions } from '../lib/productPrices';
import type { Invoice, PriceAlert, SpendingForecast, FinancialOptimization, SpendingTotals } from '../types/invoice';
import { displaySupplier } from '../lib/supplier';

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [kpis, setKpis] = useState({ total_spent: 0, invoice_count: 0, avg_amount: 0 });
  const [momChange, setMomChange] = useState(0);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [forecast, setForecast] = useState<SpendingForecast | null>(null);
  const [optimization, setOptimization] = useState<FinancialOptimization | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [totals, setTotals] = useState<SpendingTotals>({ day: 0, week: 0, month: 0 });
  const [pendingPrices, setPendingPrices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMonthlyKpis(user.id),
      getMonthOverMonthChange(user.id),
      getRecentPurchases(user.id),
      getPriceAlerts(user.id),
      getSpendingForecast(user.id),
      getFinancialOptimization(user.id),
      getOfflineQueueCount(user.id),
      getSpendingTotals(user.id),
      countPendingSuggestions().catch(() => 0),
    ]).then(([k, m, r, a, f, o, q, t, p]) => {
      setTotals(t);
      setPendingPrices(p);
      setKpis(k);
      setMomChange(m);
      setRecent(r);
      setAlerts(a.slice(0, 5));
      setForecast(f);
      setOptimization(o);
      setQueueCount(q);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (user && !profile?.nom_commerce) void refreshProfile();
  }, [user, profile, refreshProfile]);

  const greeting = profile?.nom_commerce?.trim() || 'Commerçant';
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const hasMore =
    Boolean(forecast) ||
    Boolean(optimization?.recommendation) ||
    Boolean(optimization && optimization.potential_savings > 0) ||
    alerts.length > 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="mb-5 pt-1">
        <p className="text-sm text-[#64748B]">{profile?.quartier || 'Togo'}</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-snug text-[#0F172A]">Bonjour, {greeting}</h1>
      </header>

      {queueCount > 0 && (
        <Link to="/factures">
          <Card className="mb-4 border-cyan-300/60 bg-gradient-to-br from-[#ECFEFF] to-[#CFFAFE]">
            <p className="text-sm font-medium text-cyan-900">
              {queueCount} reçu{queueCount > 1 ? 's' : ''} pas encore envoyé{queueCount > 1 ? 's' : ''}.
            </p>
            <p className="mt-1 text-xs text-cyan-800">Ça s’envoie tout seul quand le réseau revient.</p>
          </Card>
        </Link>
      )}

      {pendingPrices > 0 && (
        <Link
          to="/prix-de-vente"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#10B981]/40 bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] px-4 py-3.5 shadow-neo-card-subtle"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#059669] px-2 text-base font-bold text-white">
              {pendingPrices}
            </span>
            <span className="text-[15px] font-bold text-[#065F46]">Prix de vente à confirmer</span>
          </span>
          <span className="text-lg font-bold text-[#059669]">→</span>
        </Link>
      )}

      <section className="mb-4 rounded-2xl bg-[#1E3A8A] p-5 text-white shadow-sapphire-depth">
        <p className="text-sm text-white/80">Dépensé ce mois ({monthLabel})</p>
        <p className="mt-1 font-display text-[34px] font-bold leading-none tracking-tight">
          {formatFcfa(kpis.total_spent).replace(/\s*FCFA\s*/i, '')}{' '}
          <span className="text-base font-semibold text-cyan-200">FCFA</span>
        </p>
        <p className="mt-3 text-sm text-white/75">
          {kpis.invoice_count} reçu{kpis.invoice_count > 1 ? 's' : ''}
        </p>
      </section>

      <div className="mb-5">
        <Link to="/scanner">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-4 py-4 text-base font-bold text-white shadow-btn-electric active:scale-[0.98]"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scanner un reçu
          </button>
        </Link>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/80 bg-[#EEF2F6] p-4 shadow-neo-card">
          <p className="text-sm text-[#64748B]">Aujourd’hui</p>
          <p className="mt-1 font-display text-xl font-bold text-[#0F172A]">
            {formatFcfa(totals.day).replace(/\s*FCFA\s*/i, '')}
            <span className="ml-1 text-xs font-semibold text-[#64748B]">FCFA</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-[#EEF2F6] p-4 shadow-neo-card">
          <p className="text-sm text-[#64748B]">Cette semaine</p>
          <p className="mt-1 font-display text-xl font-bold text-[#0F172A]">
            {formatFcfa(totals.week).replace(/\s*FCFA\s*/i, '')}
            <span className="ml-1 text-xs font-semibold text-[#64748B]">FCFA</span>
          </p>
        </div>
      </section>

      <section className="pt-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0F172A]">Derniers achats</h2>
          <Link to="/factures" className="text-sm font-semibold text-[#1E3A8A]">
            Voir tout
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card className="text-center text-sm text-[#64748B]">Pas encore de reçu. Scannez le premier.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.slice(0, 4).map((inv) => (
              <Link key={inv.id} to={`/factures/${inv.id}`} className="block">
                <article className="flex items-center justify-between rounded-xl border border-white/80 bg-[#EEF2F6] p-3.5 shadow-neo-card">
                  <div className="flex items-center gap-3">
                    <InvoiceThumbnail photoPath={inv.photo_path} size={44} />
                    <div>
                      <h4 className="text-[15px] font-bold leading-snug text-[#0F172A]">
                        {displaySupplier(inv.supplier_name_raw)}
                      </h4>
                      <p className="mt-0.5 text-sm text-[#64748B]">{formatDate(inv.created_at)}</p>
                    </div>
                  </div>
                  <span className="font-display text-[15px] font-bold text-[#0F172A]">
                    {formatFcfa(invoiceLandedTotal(inv))}
                  </span>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      {hasMore && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full rounded-xl border border-white/80 bg-[#EEF2F6] py-3 text-sm font-semibold text-[#1E3A8A] shadow-neo-card"
          >
            {showMore ? 'Masquer les détails' : 'Voir plus (prix et conseils)'}
          </button>
        </div>
      )}

      {showMore && (
        <div className="mt-4 space-y-3">
          {forecast && (
            <Link to="/stats/previsions">
              <section className="rounded-2xl border border-white/90 bg-[#EEF2F6] p-4 shadow-neo-card">
                <p className="text-sm font-bold text-[#1E3A8A]">Mois prochain</p>
                <p className="mt-1 font-display text-2xl font-bold text-[#0F172A]">
                  {formatFcfa(forecast.predicted_total).replace(/\s*FCFA\s*/i, '')}{' '}
                  <span className="text-sm font-semibold text-[#64748B]">FCFA</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#475569]">{forecast.summary}</p>
              </section>
            </Link>
          )}

          {optimization?.recommendation && (
            <Link to="/stats/optimisation">
              <section className="rounded-2xl border border-[#F0DFBE] bg-[#FEF7EC] p-4 shadow-neo-card">
                <h3 className="text-sm font-bold text-[#92400E]">Conseil d’achat</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#78350F]">{optimization.recommendation}</p>
              </section>
            </Link>
          )}

          {optimization && !optimization.recommendation && optimization.potential_savings > 0 && (
            <Link to="/stats/optimisation">
              <section className="rounded-2xl border border-[#F0DFBE] bg-[#FEF7EC] p-4 shadow-neo-card">
                <p className="text-sm font-bold text-[#92400E]">Vous pouvez économiser</p>
                <p className="font-display text-xl font-bold text-[#B45309]">{formatFcfa(optimization.potential_savings)}</p>
              </section>
            </Link>
          )}

          {alerts.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold text-[#92400E]">Prix en hausse</h2>
              {alerts.map((a) => (
                <div key={a.product_name} className="mb-2 rounded-xl border border-[#F0DFBE] bg-[#FEF7EC] px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-medium text-[#0F172A]">{a.product_name}</p>
                    <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                      +{a.change_pct} %
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#B45309]">
                    {formatFcfa(a.first_price)} → {formatFcfa(a.last_price)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-[#94A3B8]">
            Moyenne par reçu : {formatFcfa(kpis.avg_amount)}
            {Math.abs(momChange) >= 5 ? ` · ${momChange >= 0 ? '+' : ''}${Math.round(momChange)} % vs mois dernier` : ''}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
