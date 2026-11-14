import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lightbulb, ShoppingBag } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { EmptyState, Notice, Spinner } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { formatAmount, formatFcfa, getFinancialOptimization } from '../lib/invoices';
import { isNamedSupplier } from '../lib/supplier';
import type { FinancialOptimization } from '../types/invoice';

export default function OptimizePage() {
  const { user, dataVersion } = useAuth();
  const [opt, setOpt] = useState<FinancialOptimization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getFinancialOptimization(user.id).then((v) => {
      setOpt(v);
      setLoading(false);
    });
  }, [user, dataVersion]);

  return (
    <AppLayout>
      <AppHeader title="Conseil d’achat" backTo="/" />

      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Compare vos fournisseurs produit par produit, transport compris, et estime ce que vous auriez économisé en achetant au moins cher.
      </p>

      {loading ? (
        <Spinner />
      ) : !opt ? (
        <EmptyState icon={ShoppingBag} title="Pas encore de comparaison" text="Validez des reçus avec des articles et le nom du vendeur pour comparer vos fournisseurs." />
      ) : (
        <>
          {opt.recommendation && (
            <Notice tone="info" title="Recommandation" className="mb-3">
              {opt.recommendation}
            </Notice>
          )}

          <Card className="mb-4">
            <p className="text-[13px] text-muted">Économie possible</p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">
              {formatAmount(opt.potential_savings)} <span className="text-base font-semibold text-muted">FCFA</span>
            </p>
            <p className="mt-2 text-[13px] text-muted">
              {opt.savings_pct.toFixed(1)} % des achats analysés ({formatFcfa(opt.actual_spent)} dépensés, {formatFcfa(opt.optimized_spent)} au mieux)
            </p>
          </Card>

          <SectionTitle>Conseils</SectionTitle>
          {opt.unnamed_count > 0 && (
            <Notice tone="warning" className="mb-2">
              {opt.unnamed_count} ligne{opt.unnamed_count > 1 ? 's' : ''} sans nom de fournisseur. Les totaux sont comptés, mais la comparaison ne porte que sur les vendeurs identifiés.
            </Notice>
          )}
          <Card padding="none" className="mb-4 divide-y divide-line">
            {opt.advice.map((a) => (
              <div key={a} className="flex items-start gap-3 px-4 py-3">
                <Lightbulb size={18} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-[14px] leading-relaxed text-ink-2">{a}</p>
              </div>
            ))}
          </Card>

          <SectionTitle>Détail par produit</SectionTitle>
          <Card padding="none" className="divide-y divide-line">
            {opt.products
              .filter((p) => p.suppliers.length >= 1)
              .map((p) => (
                <div key={p.product_name} className="px-4 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-[15px] font-medium text-ink">{p.product_name}</p>
                    {p.savings > 0 && <p className="shrink-0 text-[15px] font-semibold text-success">−{formatFcfa(p.savings)}</p>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {isNamedSupplier(p.cheapest_supplier) && p.cheapest_unit_price > 0
                      ? `Moins cher : ${formatFcfa(p.cheapest_unit_price)} chez ${p.cheapest_supplier}`
                      : 'Aucun fournisseur nommé pour ce produit.'}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {p.suppliers.map((s) => (
                      <li key={s.name} className="text-xs text-muted">
                        {s.name} · {formatFcfa(s.avg_price)} l’unité · quantité {s.qty}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </Card>

          <Link to="/stats/previsions" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Voir les prix attendus <ChevronRight size={16} />
          </Link>
        </>
      )}
    </AppLayout>
  );
}
