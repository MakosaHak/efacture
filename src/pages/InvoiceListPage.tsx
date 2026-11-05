import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchInvoices, formatDate, formatFcfa, flushOfflineQueue, getOfflineQueueCount } from '../lib/invoices';
import { invoiceLandedTotal } from '../lib/landed-cost';
import { displaySupplier } from '../lib/supplier';
import { isOfflineInvoiceId } from '../lib/offline/queue';
import { Button } from '../components/ui/Button';
import type { Invoice } from '../types/invoice';

export default function InvoiceListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const search = params.get('q') || '';
  const status = params.get('status') || '';

  const reload = () => {
    if (!user) return;
    fetchInvoices(search, status, user.id)
      .then(setInvoices)
      .finally(() => setLoading(false));
    getOfflineQueueCount(user.id).then(setQueueCount);
  };

  useEffect(() => {
    reload();
    const onOnline = () => reload();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
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

      {queueCount > 0 && (
        <Card className="mb-3 border-cyan-200 bg-cyan-50">
          <p className="text-sm text-cyan-900">
            {queueCount} facture{queueCount > 1 ? 's' : ''} sur cet appareil, pas encore envoyée
            {queueCount > 1 ? 's' : ''} au cloud.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            disabled={syncing}
            onClick={async () => {
              if (!user) return;
              setSyncing(true);
              await flushOfflineQueue(user.id);
              reload();
              setSyncing(false);
            }}
          >
            {syncing ? 'Envoi…' : 'Envoyer maintenant'}
          </Button>
        </Card>
      )}

      <form
        className="mb-3 flex items-center gap-2 rounded-xl border border-white/70 bg-[#E2E8F0] px-3 py-2 shadow-neo-inset"
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
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status === s ? 'bg-[#1E3A8A] text-white shadow-sm' : 'border border-white/70 bg-[#E2E8F0] text-[#64748B] shadow-neo-inset'}`}
          >
            {s === '' ? 'Toutes' : s === 'validated' ? 'Validées' : 'En attente'}
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-bold">Journal des factures</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="text-center">
          <p className="mb-4 text-sm text-[#64748B]">Aucune facture trouvée.</p>
          <Link to="/scanner" className="text-sm font-semibold text-[#1E3A8A]">
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
                <p className="truncate font-semibold text-sm">{displaySupplier(inv.supplier_name_raw)}</p>
                <p className="text-xs text-[#64748B]">{formatDate(inv.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatFcfa(invoiceLandedTotal(inv))}</p>
                <InvoiceStatusBadge status={inv.status} queued={isOfflineInvoiceId(inv.id)} />
              </div>
            </Card>
          </Link>
        ))
      )}
    </AppLayout>
  );
}
