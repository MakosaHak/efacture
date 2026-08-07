import { useEffect, useState } from 'react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { formatFcfa, getSpendingBySupplier } from '../lib/invoices';
import type { SupplierSpending } from '../types/invoice';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [spending, setSpending] = useState<SupplierSpending[]>([]);
  const maxTotal = spending[0]?.total || 1;

  useEffect(() => {
    if (!user) return;
    getSpendingBySupplier(user.id).then(setSpending);
  }, [user]);

  return (
    <AppLayout>
      <AppHeader title="Fournisseurs" backTo="/stats/prix" />

      <p className="mb-4 text-sm text-[#6b7280]">Dépenses des 3 derniers mois</p>

      {spending.length === 0 ? (
        <Card className="text-center text-sm text-[#6b7280]">Aucune donnée.</Card>
      ) : (
        spending.map((s) => (
          <Card key={s.supplier_name_raw} className="mb-3">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">{s.supplier_name_raw}</span>
              <span className="font-bold text-[#006d41]">{formatFcfa(s.total)}</span>
            </div>
            <div className="mb-1 h-2 overflow-hidden rounded-full bg-[#f4f6f8]">
              <div
                className="h-full rounded-full bg-[#006d41]"
                style={{ width: `${(s.total / maxTotal) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[#9ca3af]">{s.count} facture{s.count > 1 ? 's' : ''}</p>
          </Card>
        ))
      )}
    </AppLayout>
  );
}
