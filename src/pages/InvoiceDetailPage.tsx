import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Notice, Spinner } from '../components/ui/Feedback';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { InvoicePhoto } from '../components/invoices/InvoiceThumbnail';
import { deleteInvoice, fetchInvoice, formatDate, formatFcfa, getKnownSupplierNames, updateInvoiceSupplier } from '../lib/invoices';
import { invoiceLandedTotal, transportFeeOf } from '../lib/landed-cost';
import { displaySupplier, isNamedSupplier } from '../lib/supplier';
import { useAuth } from '../context/AuthContext';
import type { Invoice } from '../types/invoice';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierEdit, setSupplierEdit] = useState('');
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierSaved, setSupplierSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchInvoice(id).then((inv) => {
      if (cancelled) return;
      setInvoice(inv);
      setSupplierEdit(inv?.supplier_name_raw || '');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    getKnownSupplierNames(user.id).then(setKnownSuppliers);
  }, [user]);

  const handleDelete = async () => {
    if (!invoice || !confirm('Supprimer ce reçu et sa photo de cet appareil ?')) return;
    await deleteInvoice(invoice.id, invoice.photo_path);
    navigate('/factures', { replace: true });
  };

  if (loading) {
    return (
      <AppLayout>
        <AppHeader title="Reçu" backTo="/factures" />
        <Spinner />
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <AppHeader title="Reçu" backTo="/factures" />
        <Notice tone="warning">Ce reçu n’existe plus sur cet appareil.</Notice>
      </AppLayout>
    );
  }

  const transportFee = transportFeeOf(invoice);
  const landedTotal = invoiceLandedTotal(invoice);
  const items = invoice.invoice_items || [];

  return (
    <AppLayout>
      <AppHeader title={displaySupplier(invoice.supplier_name_raw)} subtitle={formatDate(invoice.invoice_date || invoice.created_at)} backTo="/factures" />

      <InvoicePhoto photoPath={invoice.photo_path} className="mb-3" />

      <Card className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted">Coût total réel</p>
            <p className="mt-0.5 text-[28px] font-bold leading-none tracking-tight text-ink">{formatFcfa(landedTotal)}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        {transportFee > 0 && (
          <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
            Reçu {formatFcfa(Number(invoice.total_amount))} + transport {formatFcfa(transportFee)}
          </p>
        )}
        {invoice.notes && <p className="mt-2 text-[13px] text-ink-2">{invoice.notes}</p>}
      </Card>

      {invoice.status === 'validated' && (
        <Card className="mb-4 space-y-3">
          <Input
            label="Fournisseur"
            value={supplierEdit}
            onChange={(e) => {
              setSupplierEdit(e.target.value);
              setSupplierSaved(false);
            }}
            list="known-suppliers-detail"
            placeholder="Nom du vendeur"
            hint={!isNamedSupplier(invoice.supplier_name_raw) ? 'Pas de nom sur le ticket. Indiquez le vendeur si vous le connaissez.' : undefined}
          />
          <datalist id="known-suppliers-detail">
            {knownSuppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {supplierEdit.trim() !== (invoice.supplier_name_raw || '').trim() && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              loading={savingSupplier}
              onClick={async () => {
                setSavingSupplier(true);
                try {
                  await updateInvoiceSupplier(invoice.id, supplierEdit);
                  const next = await fetchInvoice(invoice.id);
                  if (next) setInvoice(next);
                  setSupplierSaved(true);
                } finally {
                  setSavingSupplier(false);
                }
              }}
            >
              Enregistrer le fournisseur
            </Button>
          )}
          {supplierSaved && <Notice tone="success">Fournisseur enregistré.</Notice>}
        </Card>
      )}

      <SectionTitle>Articles</SectionTitle>
      {items.length === 0 ? (
        <Card className="text-[13px] text-muted">Aucun article détaillé sur ce reçu.</Card>
      ) : (
        <Card padding="none" className="divide-y divide-line">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-ink">{item.product_name || 'Article'}</p>
                <p className="text-[13px] text-muted">
                  {Number(item.quantity)} {item.unit} × {formatFcfa(Number(item.unit_price))}
                </p>
              </div>
              <span className="shrink-0 text-[15px] font-semibold text-ink">{formatFcfa(Number(item.total_price))}</span>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-5 space-y-2">
        {invoice.status === 'pending' && (
          <Link to={`/factures/${invoice.id}/valider`} className="block">
            <Button fullWidth size="lg">
              Vérifier et valider
            </Button>
          </Link>
        )}
        <Button variant="danger" fullWidth onClick={handleDelete}>
          <Trash2 size={18} />
          Supprimer ce reçu
        </Button>
      </div>
    </AppLayout>
  );
}
