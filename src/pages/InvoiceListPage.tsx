import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { EmptyState, Spinner } from '../components/ui/Feedback';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { useAuth } from '../context/AuthContext';
import { fetchInvoices, formatAmount, formatDate, formatFcfa } from '../lib/invoices';
import { invoiceLandedTotal } from '../lib/landed-cost';
import { displaySupplier } from '../lib/supplier';
import type { Invoice, InvoiceStatus } from '../types/invoice';

const FILTERS: { value: string; label: string; active: string }[] = [
  { value: '', label: 'Tous', active: 'border-primary bg-primary text-white' },
  { value: 'validated', label: 'Validés', active: 'border-success bg-success text-white' },
  { value: 'pending', label: 'À vérifier', active: 'border-amber bg-amber text-white' },
  { value: 'rejected', label: 'Rejetés', active: 'border-rose bg-rose text-white' },
];

const STATUS: Record<InvoiceStatus, { label: string; dot: string; text: string }> = {
  validated: { label: 'Validé', dot: 'bg-success', text: 'text-success' },
  pending: { label: 'À vérifier', dot: 'bg-amber', text: 'text-amber' },
  rejected: { label: 'Rejeté', dot: 'bg-rose', text: 'text-rose' },
};

function monthKey(inv: Invoice): string {
  return String(inv.invoice_date || inv.created_at).slice(0, 7);
}

function monthTitle(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function InvoiceListPage() {
  const { user, dataVersion } = useAuth();
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
  }, [user, search, status, dataVersion]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const groups = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      const k = monthKey(inv);
      (map.get(k) || map.set(k, []).get(k)!).push(inv);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [invoices]);

  const validatedTotal = invoices.filter((i) => i.status === 'validated').reduce((s, i) => s + invoiceLandedTotal(i), 0);
  const pendingCount = invoices.filter((i) => i.status === 'pending').length;

  return (
    <AppLayout>
      <AppHeader title="Mes reçus" backTo="/" />

      <div className="mb-3 rounded-card bg-primary p-4 text-white shadow-card">
        <p className="text-[13px] text-white/75">{status || search ? 'Sélection affichée' : 'Tous mes achats validés'}</p>
        <p className="mt-1 text-[26px] font-bold leading-none tracking-tight">
          {formatAmount(validatedTotal)} <span className="text-sm font-semibold text-white/75">FCFA</span>
        </p>
        <div className="mt-3 flex items-center gap-3 text-[12px] text-white/80">
          <span className="rounded-full bg-white/12 px-2.5 py-1 font-medium">
            {invoices.length} reçu{invoices.length > 1 ? 's' : ''}
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-soft px-2.5 py-1 font-semibold text-amber">
              {pendingCount} à vérifier
            </span>
          )}
        </div>
      </div>

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
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${active ? f.active : 'border-line bg-surface text-ink-2 hover:bg-surface-2'}`}
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
          illustration={search || status ? 'empty' : 'receipt'}
          title={search || status ? 'Aucun reçu ne correspond' : 'Aucun reçu pour l’instant'}
          text={search || status ? 'Changez le filtre.' : 'Scannez votre premier reçu.'}
          action={
            !search && !status ? (
              <Link to="/scanner" className="text-sm font-semibold text-primary">
                Scanner un reçu
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([key, list]) => {
            const monthTotal = list.filter((i) => i.status === 'validated').reduce((s, i) => s + invoiceLandedTotal(i), 0);
            return (
              <section key={key}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{monthTitle(key)}</h2>
                  <span className="text-[13px] font-medium text-ink-2">{formatFcfa(monthTotal)}</span>
                </div>
                <Card padding="none" className="divide-y divide-line">
                  {list.map((inv) => {
                    const st = STATUS[inv.status];
                    return (
                      <Link
                        key={inv.id}
                        to={inv.status === 'pending' ? `/factures/${inv.id}/valider` : `/factures/${inv.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                      >
                        <InvoiceThumbnail photoPath={inv.photo_path} size={48} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-ink">{displaySupplier(inv.supplier_name_raw)}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate whitespace-nowrap text-[13px] text-muted">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden />
                            <span className={st.text}>{st.label}</span>
                            <span>· {formatDate(inv.invoice_date || inv.created_at)}</span>
                          </p>
                        </div>
                        <p className={`shrink-0 text-[15px] font-semibold ${inv.status === 'rejected' ? 'text-faint line-through' : 'text-ink'}`}>
                          {formatFcfa(invoiceLandedTotal(inv))}
                        </p>
                      </Link>
                    );
                  })}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
