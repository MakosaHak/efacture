import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { deleteInvoice, fetchInvoice, formatDate, formatFcfa, getPhotoUrl, getKnownSupplierNames, updateInvoiceSupplier } from '../lib/invoices';
import { invoiceLandedTotal, transportFeeOf } from '../lib/landed-cost';
import { displaySupplier, isNamedSupplier } from '../lib/supplier';
import { isOfflineInvoiceId } from '../lib/offline/queue';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import type { Invoice } from '../types/invoice';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [supplierEdit, setSupplierEdit] = useState('');
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [savingSupplier, setSavingSupplier] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let blobUrl: string | null = null;
    fetchInvoice(id).then((inv) => {
      if (cancelled) return;
      setInvoice(inv);
      setSupplierEdit(inv?.supplier_name_raw || '');
      if (!inv?.photo_path) return;
      getPhotoUrl(inv.photo_path).then((url) => {
        if (cancelled) {
          if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        blobUrl = url;
        setPhotoUrl(url);
      });
    });
    return () => {
      cancelled = true;
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    getKnownSupplierNames(user.id).then(setKnownSuppliers);
  }, [user]);

  const handleDelete = async () => {
    if (!invoice || !confirm('Supprimer cette facture ?')) return;
    await deleteInvoice(invoice.id, invoice.photo_path);
    navigate('/factures');
  };

  if (!invoice) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const transportFee = transportFeeOf(invoice);
  const landedTotal = invoiceLandedTotal(invoice);
  const items = invoice.invoice_items || [];

  return (
    <AppLayout>
      <AppHeader title="Détail facture" backTo="/factures" />

      {photoUrl && (
        <img src={photoUrl} alt="Facture" className="mb-4 max-h-64 w-full rounded-2xl object-cover" />
      )}

      <Card className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{displaySupplier(invoice.supplier_name_raw)}</h2>
          <InvoiceStatusBadge status={invoice.status} queued={isOfflineInvoiceId(invoice.id)} />
        </div>
        <p className="text-sm text-[#64748B]">{formatDate(invoice.created_at)}</p>
        <p className="text-2xl font-bold text-[#1E3A8A]">{formatFcfa(landedTotal)}</p>
        {transportFee > 0 && (
          <p className="text-sm text-[#64748B]">
            Facture {formatFcfa(Number(invoice.total_amount))} + transport {formatFcfa(transportFee)}
          </p>
        )}
        {isOfflineInvoiceId(invoice.id) && (
          <p className="text-sm text-cyan-800">Sur cet appareil — envoi au cloud à la reconnexion.</p>
        )}
        {(invoice.notes || '').replace(/Hors-ligne[^.]*\.\s*/gi, '').trim() && (
          <p className="text-sm text-[#64748B]">
            {(invoice.notes || '').replace(/Hors-ligne[^.]*\.\s*/gi, '').trim()}
          </p>
        )}
        {!isNamedSupplier(invoice.supplier_name_raw) && (
          <p className="text-xs text-amber-800">
            Pas de nom sur le ticket. Vous pouvez indiquer le vendeur ci-dessous si vous le connaissez.
          </p>
        )}
      </Card>

      {invoice.status === 'validated' && (
        <Card className="mb-4 space-y-2">
          <Input
            label="Fournisseur"
            value={supplierEdit}
            onChange={(e) => setSupplierEdit(e.target.value)}
            list="known-suppliers-detail"
            placeholder="Nom du vendeur, si vous le connaissez"
          />
          <datalist id="known-suppliers-detail">
            {knownSuppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={savingSupplier}
            onClick={async () => {
              setSavingSupplier(true);
              try {
                await updateInvoiceSupplier(invoice.id, supplierEdit);
                const next = await fetchInvoice(invoice.id);
                if (next) setInvoice(next);
              } finally {
                setSavingSupplier(false);
              }
            }}
          >
            {savingSupplier ? 'Enregistrement…' : 'Enregistrer le fournisseur'}
          </Button>
        </Card>
      )}

      <h3 className="mb-2 text-sm font-bold">Articles</h3>
      {items.map((item, i) => (
        <Card key={item.id ?? i} className="mb-3 py-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-[#0F172A]">
              {item.product_name} <span className="font-normal text-[#64748B]">×{Number(item.quantity)}</span>
            </span>
            <span className="font-semibold">{formatFcfa(Number(item.total_price))}</span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B]">{formatFcfa(Number(item.unit_price))} / unité</p>
        </Card>
      ))}

      {invoice.status === 'pending' && (
        <Link to={`/factures/${invoice.id}/valider`}>
          <Button fullWidth className="mt-4">Valider</Button>
        </Link>
      )}
      <Button variant="danger" fullWidth className="mt-2" onClick={handleDelete}>
        Supprimer
      </Button>
    </AppLayout>
  );
}
