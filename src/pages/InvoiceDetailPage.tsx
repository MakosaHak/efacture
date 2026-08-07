import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { InvoiceStatusBadge } from '../components/invoices/InvoiceStatusBadge';
import { deleteInvoice, fetchInvoice, formatDate, formatFcfa, getPhotoUrl } from '../lib/invoices';
import type { Invoice } from '../types/invoice';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchInvoice(id).then((inv) => {
      setInvoice(inv);
      if (inv?.photo_path) getPhotoUrl(inv.photo_path).then(setPhotoUrl);
    });
  }, [id]);

  const handleDelete = async () => {
    if (!invoice || !confirm('Supprimer cette facture ?')) return;
    await deleteInvoice(invoice.id, invoice.photo_path);
    navigate('/factures');
  };

  if (!invoice) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title="Détail facture" backTo="/factures" />

      {photoUrl && (
        <img src={photoUrl} alt="Facture" className="mb-4 max-h-64 w-full rounded-2xl object-cover" />
      )}

      <Card className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{invoice.supplier_name_raw || 'Sans fournisseur'}</h2>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="text-sm text-[#6b7280]">{formatDate(invoice.created_at)}</p>
        <p className="text-2xl font-bold text-[#006d41]">{formatFcfa(Number(invoice.total_amount))}</p>
        {invoice.notes && <p className="text-sm text-[#6b7280]">{invoice.notes}</p>}
      </Card>

      <h3 className="mb-2 text-sm font-bold">Articles</h3>
      {(invoice.invoice_items || []).map((item) => (
        <Card key={item.id} className="mb-2 flex justify-between py-2 text-sm">
          <span>{item.product_name}</span>
          <span className="font-semibold">{formatFcfa(Number(item.total_price))}</span>
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
