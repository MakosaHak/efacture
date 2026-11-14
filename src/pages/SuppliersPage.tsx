import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Store } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getSpendingBySupplier } from '../lib/invoices';
import type { SupplierSpending } from '../types/invoice';

export default function SuppliersPage() {
  const { user, dataVersion } = useAuth();
  const [spending, setSpending] = useState<SupplierSpending[]>([]);
  const maxTotal = spending[0]?.total || 1;

  useEffect(() => {
    if (!user) return;
    getSpendingBySupplier(user.id, 12).then(setSpending);
  }, [user, dataVersion]);

  return (
    <AppLayout>
      <AppHeader title="Fournisseurs" backTo="/stats/prix" subtitle="Dépenses des 12 derniers mois" />

      {spending.length === 0 ? (
        <EmptyState icon={Store} title="Aucun fournisseur" text="Les vendeurs apparaissent ici dès que vous validez des reçus." />
      ) : (
        <Card padding="none" className="divide-y divide-line">
          {spending.map((s) => (
            <div key={s.supplier_name_raw} className="px-4 py-3">
              <div className="mb-2 flex justify-between gap-2 text-[15px]">
                <span className="truncate font-medium text-ink">{s.supplier_name_raw}</span>
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

      <Link to="/stats/optimisation" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Comparer les fournisseurs <ChevronRight size={16} />
      </Link>
    </AppLayout>
  );
}
