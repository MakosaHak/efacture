import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ReceiptText, Search, X } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { EmptyState, Spinner } from '../components/ui/Feedback';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchInvoices, formatDate, formatFcfa } from '../lib/invoices';
import { invoiceLandedTotal } from '../lib/landed-cost';
import { displaySupplier } from '../lib/supplier';
import type { Invoice } from '../types/invoice';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'validated', label: 'Validés' },
  { value: 'pending', label: 'À vérifier' },
  { value: 'rejected', label: 'Rejetés' },
];

export default function InvoiceListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const search = params.get('q') || '';
  const status = params.get('status') || '';
  const [query, setQuery] = useState(search);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchInvoices(user.id, search, status).then((list) => {
      if (cancelled) return;
      setInvoices(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, search, status]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <AppHeader title="Mes reçus" backTo="/" />

      <form
        className="mb-3 flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParam('q', query.trim());
        }}
        role="search"
      >
        <Search size={18} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Fournisseur, produit…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          aria-label="Rechercher un reçu"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setParam('q', '');
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-surface-2"
            aria-label="Effacer la recherche"
          >
            <X size={16} />
          </button>
        )}
      </form>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setParam('status', f.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
              }`}
              aria-pressed={active}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Spinner />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={search || status ? 'Aucun reçu ne correspond' : 'Aucun reçu pour l’instant'}
          text={search || status ? 'Modifiez la recherche ou le filtre.' : 'Scannez votre premier reçu depuis le bouton central.'}
          action={
            !search && !status ? (
              <Link to="/scanner" className="text-sm font-semibold text-primary">
                Scanner un reçu
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card padding="none" className="divide-y divide-line">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              to={inv.status === 'pending' ? `/factures/${inv.id}/valider` : `/factures/${inv.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <InvoiceThumbnail photoPath={inv.photo_path} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{displaySupplier(inv.supplier_name_raw)}</p>
                <p className="mt-0.5 text-[13px] text-muted">{formatDate(inv.invoice_date || inv.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-[15px] font-semibold text-ink">{formatFcfa(invoiceLandedTotal(inv))}</p>
                <InvoiceStatusBadge status={inv.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </AppLayout>
  );
}
