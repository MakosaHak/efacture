import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchInvoices, formatDate, formatFcfa } from '../lib/invoices';
import type { Invoice } from '../types/invoice';

export default function InvoiceListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const search = params.get('q') || '';
  const status = params.get('status') || '';

  useEffect(() => {
    if (!user) return;
    fetchInvoices(search, status)
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, [user, search, status]);

  const setFilter = (s: string) => {
    const next = new URLSearchParams(params);
    if (s) next.set('status', s);
    else next.delete('status');
    setParams(next);
  };

  return (
    <AppLayout>
      <AppHeader title="Historique" backTo="/" />

      <form
        className="mb-3 flex items-center gap-2 rounded-xl border border-[#e8ecf0] bg-white px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const q = String(fd.get('q') || '');
          const next = new URLSearchParams(params);
          if (q) next.set('q', q);
          else next.delete('q');
          setParams(next);
        }}
      >
        <span>🔍</span>
        <input name="q" defaultValue={search} placeholder="Rechercher une facture…" className="flex-1 bg-transparent text-sm outline-none" />
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {['', 'validated', 'pending'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status === s ? 'bg-[#006d41] text-white' : 'bg-white text-[#6b7280] border border-[#e8ecf0]'}`}
          >
            {s === '' ? 'Toutes' : s === 'validated' ? 'Validées' : 'En attente'}
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-bold">Journal des factures</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="text-center">
          <p className="mb-4 text-sm text-[#6b7280]">Aucune facture trouvée.</p>
          <Link to="/scanner" className="text-sm font-semibold text-[#006d41]">
            Scanner ma première facture
          </Link>
        </Card>
      ) : (
        invoices.map((inv) => (
          <Link
            key={inv.id}
            to={inv.status === 'pending' ? `/factures/${inv.id}/valider` : `/factures/${inv.id}`}
          >
            <Card className="mb-2 flex items-center gap-3 py-3">
              <InvoiceThumbnail photoPath={inv.photo_path} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">{inv.supplier_name_raw || 'Sans fournisseur'}</p>
                <p className="text-xs text-[#6b7280]">{formatDate(inv.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatFcfa(Number(inv.total_amount))}</p>
                <InvoiceStatusBadge status={inv.status} />
              </div>
            </Card>
          </Link>
        ))
      )}
    </AppLayout>
  );
}
