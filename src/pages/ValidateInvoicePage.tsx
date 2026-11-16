import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge, Notice, Spinner } from '../components/ui/Feedback';
import { InvoicePhoto } from '../components/invoices/InvoiceThumbnail';
import { fetchInvoice, formatFcfa, getKnownSupplierNames, rejectInvoice, validateInvoice } from '../lib/invoices';
import { transportFeeOf } from '../lib/landed-cost';
import { invoiceTotalGap } from '../lib/pricing';
import { isNamedSupplier } from '../lib/supplier';
import { useAuth } from '../context/AuthContext';
import type { Invoice, InvoiceItem } from '../types/invoice';

export default function ValidateInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [supplier, setSupplier] = useState('');
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [transport, setTransport] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchInvoice(id).then((inv) => {
      if (!inv) {
        setLoading(false);
        return;
      }
      setInvoice(inv);
      setSupplier(inv.supplier_name_raw || '');
      setDate(inv.invoice_date || '');
      setTotal(inv.total_amount ? String(inv.total_amount) : '');
      const fee = transportFeeOf(inv);
      setTransport(fee ? String(fee) : '');
      setNotes(inv.notes || '');
      setItems(
        (inv.invoice_items || []).map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total_price: Number(it.total_price),
        })),
      );
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!user) return;
    getKnownSupplierNames(user.id).then(setKnownSuppliers);
  }, [user]);

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

  const totalCheck = invoiceTotalGap(parseFloat(total) || 0, items);
  const landed = (parseFloat(total) || 0) + (parseFloat(transport) || 0);

  const addItem = () => setItems((prev) => [...prev, { product_name: '', quantity: 1, unit: 'pièce', unit_price: 0, total_price: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleValidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSaving(true);
    try {
      await validateInvoice(id, {
        supplier_name_raw: supplier,
        invoice_date: date || null,
        total_amount: parseFloat(total) || 0,
        transport_fee: parseFloat(transport) || 0,
        notes,
        items: items.filter((it) => it.product_name.trim() || it.unit_price > 0),
      });
      navigate(`/factures/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!id || !confirm('Rejeter ce reçu ? Il restera dans la liste comme rejeté.')) return;
    await rejectInvoice(id);
    navigate('/factures', { replace: true });
  };

  if (loading) {
    return (
      <AppLayout>
        <AppHeader title="Vérifier le reçu" backTo="/factures" />
        <Spinner />
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <AppHeader title="Vérifier le reçu" backTo="/factures" />
        <Notice tone="warning">Ce reçu n’existe plus sur cet appareil.</Notice>
      </AppLayout>
    );
  }

  const conf = invoice.ocr_raw_data?.confidence;

  return (
    <AppLayout>
      <AppHeader title="Vérifier le reçu" backTo="/factures" />

      <InvoicePhoto photoPath={invoice.photo_path} className="mb-3" />

      {invoice.notes ? (
        <Notice tone="warning" className="mb-3">
          {invoice.notes}
        </Notice>
      ) : conf != null ? (
        <Notice tone="info" className="mb-3">
          {String(invoice.ocr_raw_data?.provider || '').startsWith('ia:') ? 'Lu par l’assistant' : 'Lecture automatique'} à {Math.round(conf * 100)} %. Vérifiez les montants.
        </Notice>
      ) : null}

      <form onSubmit={handleValidate} className="space-y-4">
        <Card className="space-y-3">
          <Input
            label="Fournisseur (facultatif)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            list="known-suppliers"
            placeholder="Nom du vendeur"
            hint={!isNamedSupplier(supplier) ? 'Vous pourrez le compléter plus tard.' : undefined}
          />
          <datalist id="known-suppliers">
            {knownSuppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Montant du reçu" type="number" inputMode="numeric" min={0} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" />
          </div>
          <Input
            label="Transport (FCFA, facultatif)"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Ex. : 3000"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
          />
          <div className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2.5">
            <p className="text-[13px] text-muted">Coût total réel</p>
            <p className="text-[15px] font-semibold text-ink">{formatFcfa(landed)}</p>
          </div>
          <Input label="Remarque (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. : livraison partielle" />
        </Card>

        <div>
          <SectionTitle action={<Badge>{items.length} article{items.length > 1 ? 's' : ''}</Badge>}>Articles</SectionTitle>

          {totalCheck.mismatch && (
            <Notice
              tone="warning"
              title="Écart à vérifier"
              className="mb-3"
              action={
                <button type="button" className="text-[13px] font-semibold text-warning underline underline-offset-2" onClick={() => setTotal(String(totalCheck.linesSum))}>
                  Utiliser la somme des articles ({formatFcfa(totalCheck.linesSum)})
                </button>
              }
            >
              Montant du reçu : {formatFcfa(parseFloat(total) || 0)}. Somme des articles : {formatFcfa(totalCheck.linesSum)}.{' '}
              {totalCheck.gap > 0 ? 'Un article a peut-être été oublié.' : 'Une quantité ou un prix est peut-être mal lu.'}
            </Notice>
          )}

          <div className="space-y-3">
            {items.map((item, i) => (
              <Card key={i} className="space-y-3">
                <Input label="Produit" value={item.product_name} onChange={(e) => updateItem(i, 'product_name', e.target.value)} placeholder="Ex. : Sac de riz 50 kg" />
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Quantité" type="number" inputMode="decimal" min={0} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} />
                  <Input label="Prix unitaire" type="number" inputMode="numeric" min={0} value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                  <Input label="Total" type="number" value={item.total_price} readOnly />
                </div>
                <button type="button" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-danger" onClick={() => removeItem(i)}>
                  <Trash2 size={15} />
                  Retirer cet article
                </button>
              </Card>
            ))}
          </div>

          <Button type="button" variant="secondary" fullWidth className="mt-3" onClick={addItem}>
            <Plus size={18} />
            Ajouter un article
          </Button>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="space-y-2 pt-2">
          <Button type="submit" fullWidth size="lg" loading={saving}>
            Valider ce reçu
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={handleReject}>
            Rejeter
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
