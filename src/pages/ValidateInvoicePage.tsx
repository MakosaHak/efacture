import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { fetchInvoice, getPhotoUrl, rejectInvoice, validateInvoice } from '../lib/invoices';
import type { Invoice, InvoiceItem } from '../types/invoice';

export default function ValidateInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchInvoice(id).then((inv) => {
      if (!inv) return;
      setInvoice(inv);
      setSupplier(inv.supplier_name_raw || '');
      setDate(inv.invoice_date || '');
      setTotal(String(inv.total_amount || ''));
      setNotes(inv.notes || '');
      setItems(
        (inv.invoice_items || []).map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total_price: Number(it.total_price),
        })),
      );
      if (inv.photo_path) getPhotoUrl(inv.photo_path).then(setPhotoUrl);
      setLoading(false);
    });
  }, [id]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = Number(item.quantity) * Number(item.unit_price);
      }
      next[index] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { product_name: '', quantity: 1, unit: 'pièce', unit_price: 0, total_price: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await validateInvoice(id, {
        supplier_name_raw: supplier,
        invoice_date: date || null,
        total_amount: parseFloat(total) || 0,
        notes,
        items,
      });
      navigate(`/factures/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectInvoice(id);
    navigate('/factures');
  };

  if (loading || !invoice) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const conf = invoice.ocr_raw_data?.confidence;
  const provider = invoice.ocr_raw_data?.provider || 'tesseract.js';

  return (
    <AppLayout>
      <AppHeader title="Valider la facture" backTo="/scanner" />

      {(photoUrl || invoice.photo_path) && (
        <div className="mb-4 overflow-hidden rounded-2xl">
          {photoUrl ? (
            <img src={photoUrl} alt="Facture" className="max-h-48 w-full object-cover" />
          ) : (
            <InvoiceThumbnail photoPath={invoice.photo_path} size={200} />
          )}
        </div>
      )}

      {invoice.notes ? (
        <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-800">{invoice.notes}</Card>
      ) : (
        <Card className="mb-4 border-blue-200 bg-blue-50 text-sm text-blue-800">
          OCR {provider === 'tesseract.js' ? 'Tesseract.js' : provider}
          {conf != null && ` — confiance ${Math.round(conf * 100)}%`}. Vérifiez les champs.
        </Card>
      )}

      <form onSubmit={handleValidate} className="space-y-4">
        <Card className="space-y-3">
          <Input label="Fournisseur" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Montant total (FCFA)" type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Articles extraits</h2>
          <span className="rounded-full bg-[#e8f5ee] px-2 py-0.5 text-xs font-semibold text-[#006d41]">
            {items.length} article{items.length > 1 ? 's' : ''}
          </span>
        </div>

        {items.map((item, i) => (
          <Card key={i} className="space-y-2">
            <Input label="Produit" value={item.product_name} onChange={(e) => updateItem(i, 'product_name', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Qté" type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} />
              <Input label="P.U." type="number" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
              <Input label="Total" type="number" value={item.total_price} readOnly />
            </div>
            <button type="button" className="text-xs text-red-600" onClick={() => removeItem(i)}>
              Supprimer la ligne
            </button>
          </Card>
        ))}

        <Button type="button" variant="secondary" fullWidth onClick={addItem}>
          + Ajouter une ligne
        </Button>

        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer et valider'}
        </Button>
        <Button type="button" variant="secondary" fullWidth onClick={handleReject}>
          Rejeter la facture
        </Button>
      </form>
    </AppLayout>
  );
}
