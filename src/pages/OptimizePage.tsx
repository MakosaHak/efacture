import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getFinancialOptimization } from '../lib/invoices';
import { isNamedSupplier } from '../lib/supplier';
import type { FinancialOptimization } from '../types/invoice';

export default function OptimizePage() {
  const { user } = useAuth();
  const [opt, setOpt] = useState<FinancialOptimization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getFinancialOptimization(user.id).then((v) => {
      setOpt(v);
      setLoading(false);
    });
  }, [user]);

  return (
    <AppLayout>
      <AppHeader title="Optimisation" backTo="/" />

      <p className="mb-4 text-xs leading-relaxed text-[#64748B]">
        L’app croise la tendance de prix de chaque fournisseur (régression linéaire) pour prédire qui sera le
        plus rentable le mois prochain. La simulation historique (fournisseur le moins cher observé) reste
        affichée en complément.
      </p>

      {loading ? (
        <Card className="text-center text-sm text-[#64748B]">Calcul…</Card>
      ) : !opt ? (
        <Card className="text-sm text-[#64748B]">Validez des factures avec des lignes produits pour lancer le calcul.</Card>
      ) : (
        <>
          {opt.recommendation && (
            <Card className="mb-4 border-[#F0DFBE] bg-gradient-to-br from-[#FEF7EC] to-[#F7ECD8]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D97706] shadow-[0_0_6px_#F59E0B]" />
                <p className="text-xs font-bold uppercase tracking-wider text-[#92400E]">Recommandation d’approvisionnement</p>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#78350F]">{opt.recommendation}</p>
            </Card>
          )}

          <Card className="relative mb-4 overflow-hidden border-blue-400/20 bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0F172A] text-white shadow-sapphire-depth">
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#06B6D4]/25 to-[#10B981]/15 blur-2xl" />
            <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[#06B6D4] via-[#38BDF8] to-[#10B981]" />
            <p className="text-sm opacity-90">Économie potentielle</p>
            <p className="text-3xl font-bold">{formatFcfa(opt.potential_savings)}</p>
            <p className="mt-1 text-xs opacity-80">
              {opt.savings_pct.toFixed(1)} % des achats analysés ({formatFcfa(opt.actual_spent)} →{' '}
              {formatFcfa(opt.optimized_spent)})
            </p>
          </Card>

          <h2 className="mb-2 text-sm font-bold">Conseils</h2>
          {opt.unnamed_count > 0 && (
            <Card className="mb-2 border-amber-200 bg-amber-50 py-2">
              <p className="text-sm text-amber-900">
                {opt.unnamed_count} ligne{opt.unnamed_count > 1 ? 's' : ''} sans nom de fournisseur. Les totaux
                restent comptés ; les conseils d’arbitrage ne portent que sur les vendeurs identifiés.
              </p>
            </Card>
          )}
          {opt.advice.map((a) => (
            <Card key={a} className="mb-2 py-2">
              <p className="text-sm">{a}</p>
            </Card>
          ))}

          <h2 className="mb-2 mt-4 text-sm font-bold">Détail par produit</h2>
          {opt.products
            .filter((p) => p.suppliers.length >= 1)
            .map((p) => (
              <Card key={p.product_name} className="mb-3">
                <div className="mb-1 flex justify-between gap-2">
                  <p className="text-sm font-semibold">{p.product_name}</p>
                  <p className="text-sm font-bold text-[#1E3A8A]">{formatFcfa(p.savings)}</p>
                </div>
                <p className="text-xs text-[#64748B]">
                  {isNamedSupplier(p.cheapest_supplier) && p.cheapest_unit_price > 0
                    ? `Meilleur prix identifié : ${formatFcfa(p.cheapest_unit_price)} chez ${p.cheapest_supplier}`
                    : 'Aucun fournisseur nommé : pas d’arbitrage possible pour ce produit.'}
                </p>
                {p.suppliers.map((s) => (
                  <p key={s.name} className="text-xs text-[#94A3B8]">
                    {s.name} · {formatFcfa(s.avg_price)} · qté {s.qty}
                  </p>
                ))}
              </Card>
            ))}

          <Link to="/stats/previsions" className="text-sm font-semibold text-[#1E3A8A]">
            Voir les prévisions de prix →
          </Link>
        </>
      )}
    </AppLayout>
  );
}
