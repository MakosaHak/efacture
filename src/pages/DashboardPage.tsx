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
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const forecastFill = forecast
    ? Math.min(100, Math.max(6, Math.round((forecast.avg_3m / Math.max(forecast.predicted_total, 1)) * 100)))
    : 0;
  const momLabel =
    Math.abs(momChange) < 5
      ? 'Stable ce mois'
      : `${momChange >= 0 ? '+' : ''}${Math.round(momChange)} % vs mois dernier`;

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
      {/* Header : badge marché + salutation éditoriale + avatar néomorphique */}
      <header className="mb-5 flex items-center justify-between pt-2">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full border border-[#CBD5E1] bg-[#E2E8F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] shadow-neo-inset">
              Marché Local
            </span>
            <span className="text-[11px] font-semibold tracking-tight text-[#64748B]">
              {profile?.quartier || 'Togo'} • Togo
            </span>
          </div>
          <h1 className="font-editorial text-[20px] font-bold leading-snug tracking-tight text-[#0F172A]">
            Bonjour, <span className="font-semibold italic text-[#1E3A8A]">{greeting}</span>
          </h1>
        </div>
        <div className="relative ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-[#E2E8F0] to-[#CBD5E1] font-editorial text-lg font-bold italic text-[#1E3A8A] shadow-neo-card">
          {greeting.charAt(0).toUpperCase()}
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#E2E8F0] bg-[#10B981]" />
        </div>
      </header>

      {queueCount > 0 && (
        <Link to="/factures">
          <Card className="mb-4 border-cyan-300/60 bg-gradient-to-br from-[#ECFEFF] to-[#CFFAFE]">
            <p className="text-sm font-medium text-cyan-900">
              {queueCount} facture{queueCount > 1 ? 's' : ''} sur cet appareil, pas encore envoyée
              {queueCount > 1 ? 's' : ''} au cloud.
            </p>
            <p className="mt-1 text-xs text-cyan-800">Envoi automatique à la reconnexion · Journal →</p>
          </Card>
        </Link>
      )}

      {pendingPrices > 0 && (
        <Link
          to="/prix-de-vente"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#10B981]/40 bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] px-4 py-3 shadow-neo-card-subtle"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#059669] px-2 font-display text-sm font-bold text-white shadow-sm">
              {pendingPrices}
            </span>
            <span className="text-sm font-bold text-[#065F46]">
              prix de vente à confirmer
            </span>
          </span>
          <span className="text-sm font-bold text-[#059669]">→</span>
        </Link>
      )}

      {/* Hero : carte saphir profonde */}
      <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0F172A] p-5 text-white shadow-sapphire-depth">
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-gradient-to-br from-[#06B6D4]/25 to-[#10B981]/15 blur-2xl" />
        <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[#06B6D4] via-[#38BDF8] to-[#10B981]" />
        <div className="relative z-10 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Dépenses du mois
            </p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 shadow-sm backdrop-blur-sm">
            Compte Pro
          </span>
        </div>
        <p className="relative z-10 mt-1 font-display text-[32px] font-bold leading-none tracking-tight text-white">
          {formatFcfa(kpis.total_spent).replace(/\s*FCFA\s*/i, '')}{' '}
          <span className="text-sm font-semibold uppercase tracking-normal text-cyan-300">FCFA</span>
        </p>
        <p className="relative z-10 mt-1 text-[11px] font-medium capitalize text-slate-300/80">{monthLabel}</p>
        <div className="relative z-10 mt-4 flex items-center justify-between border-t border-white/10 pt-3.5 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[11px] font-medium text-slate-300">Bilan provisoire consolidé</span>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2 py-0.5 text-[10px] font-bold text-[#10B981] shadow-inner">
            Journal à jour
          </span>
        </div>
      </section>

      {/* Dépenses du jour & de la semaine */}
      <section className="mb-4 grid grid-cols-2 gap-3.5">
        {[
          { label: "Aujourd'hui", value: totals.day, dot: 'bg-[#06B6D4] shadow-[0_0_6px_#06B6D4]' },
          { label: 'Cette semaine', value: totals.week, dot: 'bg-[#2563EB] shadow-[0_0_6px_#2563EB]' },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] p-4 shadow-neo-card"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              {t.label}
            </p>
            <p className="mt-2">
              <span className="font-display text-[19px] font-bold leading-tight text-[#0F172A]">
                {formatFcfa(t.value).replace(/\s*FCFA\s*/i, '')}
              </span>
              <span className="ml-0.5 text-[11px] font-semibold text-[#64748B]">FCFA</span>
            </p>
          </div>
        ))}
      </section>

      {/* Bento : factures & moyenne */}
      <section className="mb-4 grid grid-cols-2 gap-3.5">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] p-4 shadow-neo-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Factures</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/70 bg-[#E2E8F0] text-[#1E3A8A] shadow-neo-inset">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                <path d="M9 7h6m-6 4h6m-6 4h4" />
              </svg>
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold leading-none text-[#0F172A]">{kpis.invoice_count}</span>
            <span className="rounded bg-[#06B6D4]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#06B6D4]">Reçus</span>
          </div>
          <span className="text-[11px] font-medium text-[#64748B]">reçus enregistrés</span>
        </div>
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] p-4 shadow-neo-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Moy. / facture</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/70 bg-[#E2E8F0] text-[#10B981] shadow-neo-inset">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="my-2">
            <span className="font-display text-[19px] font-bold leading-tight text-[#0F172A]">
              {formatFcfa(kpis.avg_amount).replace(/\s*FCFA\s*/i, '')}
            </span>
            <span className="ml-0.5 text-[11px] font-semibold text-[#64748B]">FCFA</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[11px] font-bold ${Math.abs(momChange) < 5 ? 'text-[#059669]' : 'text-[#B45309]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${Math.abs(momChange) < 5 ? 'bg-[#10B981] shadow-[0_0_5px_#10B981]' : 'bg-[#F59E0B] shadow-[0_0_5px_#F59E0B]'}`} />
            {momLabel}
          </span>
        </div>
      </section>

      {/* Prévision trésorerie */}
      {forecast && (
        <Link to="/stats/previsions">
          <section className="relative mb-4 rounded-2xl border border-white/90 bg-gradient-to-br from-[#EEF2F6] via-[#E4EAF2] to-[#DCE4EE] p-4 shadow-neo-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                Prévision trésorerie
              </span>
              <span className="rounded-md border border-[#1E3A8A]/20 bg-[#1E3A8A]/10 px-2 py-0.5 text-[10px] font-bold text-[#1E3A8A] shadow-neo-inset">
                Modèle IA Marché
              </span>
            </div>
            <p className="font-display text-[23px] font-bold tracking-tight text-[#0F172A]">
              {formatFcfa(forecast.predicted_total).replace(/\s*FCFA\s*/i, '')}{' '}
              <span className="text-xs font-bold uppercase tracking-normal text-[#64748B]">FCFA</span>
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#CBD5E1] shadow-neo-inset">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4]"
                style={{ width: `${forecastFill}%` }}
              />
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#475569]">{forecast.summary}</p>
          </section>
        </Link>
      )}

      {/* Recommandation d'approvisionnement */}
      {optimization?.recommendation && (
        <Link to="/stats/optimisation">
          <section className="relative mb-4 overflow-hidden rounded-2xl border border-[#F0DFBE] bg-gradient-to-br from-[#FEF7EC] to-[#F7ECD8] p-4 shadow-neo-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D97706] shadow-[0_0_6px_#F59E0B]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                  Recommandation d'approvisionnement
                </h3>
              </div>
              <span className="rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                Optimisation
              </span>
            </div>
            <p className="text-[12.5px] font-normal leading-relaxed text-[#78350F]">{optimization.recommendation}</p>
          </section>
        </Link>
      )}

      {optimization && !optimization.recommendation && optimization.potential_savings > 0 && (
        <Link to="/stats/optimisation">
          <section className="relative mb-4 overflow-hidden rounded-2xl border border-[#F0DFBE] bg-gradient-to-br from-[#FEF7EC] to-[#F7ECD8] p-4 shadow-neo-card">
            <p className="text-xs font-bold uppercase tracking-wider text-[#92400E]">Économie potentielle</p>
            <p className="font-display text-xl font-bold text-[#B45309]">{formatFcfa(optimization.potential_savings)}</p>
            <p className="mt-1 text-xs text-[#92400E]/70">Simulation sur l'historique · détail →</p>
          </section>
        </Link>
      )}

      {/* CTA scan */}
      <div className="mb-5 pt-1">
        <Link to="/scanner">
          <button
            type="button"
            className="group relative flex w-full items-center justify-center space-x-2.5 overflow-hidden rounded-xl border border-blue-400/40 bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0284C7] px-4 py-3.5 text-sm font-medium text-white shadow-btn-electric transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
          >
            <div className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
            <svg className="h-5 w-5 stroke-[2] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-bold tracking-wide">Scanner un reçu maintenant</span>
          </button>
        </Link>
      </div>

      {/* Alertes inflation */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-bold text-[#92400E]">Alertes inflation</h2>
          {alerts.map((a) => (
            <div
              key={a.product_name}
              className="mb-2 rounded-xl border border-[#F0DFBE] bg-gradient-to-br from-[#FEF7EC] to-[#F7ECD8] px-3.5 py-2 shadow-neo-card-subtle"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#0F172A]">{a.product_name}</p>
                <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  +{a.change_pct} %
                </span>
              </div>
              <p className="text-xs font-semibold text-[#B45309]">
                {formatFcfa(a.first_price)} → {formatFcfa(a.last_price)} sur 6 mois
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Derniers achats */}
      <section className="pt-1">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold tracking-tight text-[#0F172A]">Derniers achats</h2>
            <span className="font-editorial text-[11px] italic text-[#64748B]">registre courant</span>
          </div>
          {recent.length > 0 && (
            <span className="rounded-full border border-white/80 bg-[#E2E8F0] px-2.5 py-0.5 text-[11px] font-bold text-[#1E3A8A] shadow-neo-inset">
              {recent.length} opération{recent.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {recent.length === 0 ? (
          <Card className="text-center text-sm text-[#64748B]">Aucun achat validé.</Card>
        ) : (
          <div className="flex flex-col gap-4">
            {recent.map((inv) => (
              <Link key={inv.id} to={`/factures/${inv.id}`} className="block">
                <article className="flex items-center justify-between rounded-xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] p-3.5 shadow-neo-card">
                  <div className="flex items-center space-x-3.5">
                    <InvoiceThumbnail photoPath={inv.photo_path} size={40} />
                    <div>
                      <h4 className="text-[13px] font-bold leading-snug text-[#0F172A]">
                        {displaySupplier(inv.supplier_name_raw)}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">{formatDate(inv.created_at)}</p>
                    </div>
                  </div>
                  <span className="font-display text-[13px] font-bold tracking-tight text-[#0F172A]">
                    {formatFcfa(invoiceLandedTotal(inv))}
                  </span>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
