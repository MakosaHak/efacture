import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InvoiceThumbnail } from '../components/invoices/InvoiceThumbnail';
import { MarginPicker } from '../components/ui/MarginPicker';
import {
  fetchInvoice,
  formatDate,
  formatFcfa,
  getKnownSupplierNames,
  getLastPurchasePrices,
  getPhotoUrl,
  rejectInvoice,
  validateInvoice,
} from '../lib/invoices';
import { transportFeeOf } from '../lib/landed-cost';
import {
  computeItemsPricing,
  DEFAULT_MARGIN_PCT,
  invoiceTotalGap,
  PRICE_INCREASE_ALERT_PCT,
  priceIncreasePct,
  productKey,
} from '../lib/pricing';
import { displaySupplier, isNamedSupplier } from '../lib/supplier';
import { isOfflineInvoiceId } from '../lib/offline/queue';
import { useAuth } from '../context/AuthContext';
import type { Invoice, InvoiceItem, LastPurchasePrice } from '../types/invoice';

/** pv_manuel : le commerçant a saisi lui-même le prix de vente. */
type EditableItem = InvoiceItem & { pv_manuel?: boolean };

export default function ValidateInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [transport, setTransport] = useState('');
  const [margin, setMargin] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [lastPrices, setLastPrices] = useState<Map<string, LastPurchasePrice>>(new Map());
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
      const fee = transportFeeOf(inv);
      setTransport(fee ? String(fee) : '');
      setNotes((inv.notes || '').replace(/Hors-ligne[^.]*\.\s*/gi, '').trim());
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

  useEffect(() => {
    if (!user) return;
    getKnownSupplierNames(user.id).then(setKnownSuppliers);
    getLastPurchasePrices(user.id, id).then(setLastPrices);
  }, [user, id]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item: EditableItem = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = Number(item.quantity) * Number(item.unit_price);
        // le coût change : on repart du prix conseillé
        item.pv_manuel = false;
      }
      next[index] = item;
      return next;
    });
  };

  const setManualSellPrice = (index: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] =
        value.trim() === ''
          ? { ...next[index], pv_manuel: false }
          : { ...next[index], pv_manuel: true, prix_de_vente_conseille: Math.max(0, parseFloat(value) || 0) };
      return next;
    });
  };

  const marginInput = margin ?? String(profile?.marge_beneficiaire_defaut ?? DEFAULT_MARGIN_PCT);
  const marginPct = parseFloat(marginInput) || 0;
  const transportFee = parseFloat(transport) || 0;
  const pricing = computeItemsPricing(items, {
    invoiceTotal: parseFloat(total) || 0,
    transportFee,
    marginPct,
  });
  const totalCheck = invoiceTotalGap(parseFloat(total) || 0, items);
  const sellPriceOf = (i: number) =>
    items[i]?.pv_manuel ? Number(items[i].prix_de_vente_conseille) || 0 : pricing[i]?.prix_de_vente_conseille ?? 0;

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
        transport_fee: parseFloat(transport) || 0,
        notes,
        items: items.map(({ pv_manuel: _manual, ...item }, i) => ({
          ...item,
          frais_transport_attribues: pricing[i].frais_transport_attribues,
          cout_de_revient_unitaire: pricing[i].cout_de_revient_unitaire,
          prix_de_vente_conseille: sellPriceOf(i),
        })),
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const conf = invoice.ocr_raw_data?.confidence;
  const provider = invoice.ocr_raw_data?.provider || 'tesseract.js';
  const extraNotes = (invoice.notes || '').replace(/Hors-ligne[^.]*\.\s*/gi, '').trim();

  return (
    <AppLayout>
      <AppHeader title="Valider la facture" backTo="/scanner" />

      {(photoUrl || invoice.photo_path) && (
        <div className="mb-4 overflow-hidden rounded-2xl">
          {photoUrl ? (
            <img src={photoUrl} alt="Facture" className="max-h-80 w-full bg-white object-contain" />
          ) : (
            <InvoiceThumbnail photoPath={invoice.photo_path} size={200} />
          )}
        </div>
      )}

      {isOfflineInvoiceId(invoice.id) && (
        <Card className="mb-4 border-cyan-200 bg-cyan-50 text-sm text-cyan-900">
          Enregistré sur cet appareil. Envoi automatique au cloud dès que le réseau reviendra. Les totaux
          du tableau de bord n’incluent pas encore cette facture.
        </Card>
      )}

      {extraNotes ? (
        <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-800">{extraNotes}</Card>
      ) : !isOfflineInvoiceId(invoice.id) ? (
        <Card className="mb-4 border-blue-200 bg-blue-50 text-sm text-blue-800">
          OCR {provider === 'tesseract.js' ? 'Tesseract.js' : provider}
          {conf != null && ` — confiance ${Math.round(conf * 100)}%`}. Vérifiez les champs.
        </Card>
      ) : null}

      <form onSubmit={handleValidate} className="space-y-4">
        <Card className="space-y-3">
          <Input
            label="Fournisseur (facultatif)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            list="known-suppliers"
            placeholder="Si le ticket n’a pas de nom, laissez vide"
          />
          <datalist id="known-suppliers">
            {knownSuppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {!isNamedSupplier(supplier) && (
            <p className="text-xs leading-relaxed text-[#64748B]">
              Vous pouvez valider sans nom. La facture apparaîtra comme « Sans fournisseur ». Vous pourrez
              compléter le vendeur plus tard. Sans nom, l’optimisation des achats est moins précise.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              label="Montant facture (lu par l'IA)"
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <Input
            label="Frais de transport / logistique (FCFA)"
            type="number"
            min={0}
            placeholder="Ex. 3000 — taxi, keke, pousse-pousse"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
          />
          <p className="text-xs text-[#64748B]">
            Payé de main à main, sans ticket à scanner. Laissez vide s’il n’y a pas eu de transport.
          </p>
          <div className="rounded-xl bg-[#E2E8F0] px-3 py-2">
            <p className="text-xs text-[#64748B]">Coût total réel d’approvisionnement</p>
            <p className="text-lg font-bold text-[#1E3A8A]">
              {formatFcfa((parseFloat(total) || 0) + (parseFloat(transport) || 0))}
            </p>
            {(parseFloat(transport) || 0) > 0 && (
              <p className="text-xs text-[#64748B]">
                {formatFcfa(parseFloat(total) || 0)} + {formatFcfa(parseFloat(transport) || 0)} de transport
              </p>
            )}
          </div>
          <MarginPicker value={marginInput} onChange={setMargin} title="Votre bénéfice sur cette facture" />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Articles extraits</h2>
          <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-xs font-semibold text-[#1E3A8A]">
            {items.length} article{items.length > 1 ? 's' : ''}
          </span>
        </div>

        {totalCheck.mismatch && (
          <div className="rounded-2xl border border-[#F0DFBE] bg-gradient-to-br from-[#FEF7EC] to-[#F7ECD8] p-3 shadow-neo-card-subtle">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D97706] shadow-[0_0_6px_#F59E0B]" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#92400E]">Écart à vérifier</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#78350F]">
              Total lu sur le reçu : <strong>{formatFcfa(parseFloat(total) || 0)}</strong> · somme des articles :{' '}
              <strong>{formatFcfa(totalCheck.linesSum)}</strong> ({totalCheck.gap > 0 ? '+' : '−'}
              {formatFcfa(Math.abs(totalCheck.gap))}).{' '}
              {totalCheck.gap > 0
                ? 'Un article a peut-être été oublié par l’IA.'
                : 'Une quantité ou un prix est peut-être mal lu.'}
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-bold text-[#B45309] underline"
              onClick={() => setTotal(String(totalCheck.linesSum))}
            >
              Utiliser la somme des articles comme total
            </button>
          </div>
        )}
        {lastPrices.size > 0 && (
          <p className="-mt-2 text-[10px] text-[#94A3B8]">
            Badge rouge : prix d’achat en hausse de plus de {PRICE_INCREASE_ALERT_PCT} % depuis le dernier achat enregistré.
          </p>
        )}

        {items.map((item, i) => {
          const p = pricing[i];
          const sellPrice = sellPriceOf(i);
          const last = lastPrices.get(productKey(item.product_name));
          const increase = last ? priceIncreasePct(Number(item.unit_price), last.unit_price) : null;
          const belowCost = sellPrice > 0 && sellPrice < p.cout_de_revient_unitaire;
          return (
            <Card key={i} className="space-y-2">
              <Input label="Produit" value={item.product_name} onChange={(e) => updateItem(i, 'product_name', e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <Input label="Qté" type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} />
                <Input label="P.U." type="number" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                <Input label="Total" type="number" value={item.total_price} readOnly />
              </div>

              {increase != null && last && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <span className="mt-0.5 shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    +{increase} %
                  </span>
                  <p className="text-xs leading-relaxed text-red-900">
                    <strong>Hausse de prix fournisseur</strong> depuis le dernier achat :{' '}
                    {formatFcfa(last.unit_price)} le {formatDate(last.date)}
                    {isNamedSupplier(last.supplier_name_raw) ? ` chez ${displaySupplier(last.supplier_name_raw)}` : ''}.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/70 bg-[#E2E8F0] px-2.5 py-2 shadow-neo-inset">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Acheté à</p>
                  <p className="mt-0.5 font-display text-sm font-bold text-[#0F172A]">{formatFcfa(Number(item.unit_price))}</p>
                </div>
                <div className="rounded-xl border border-white/70 bg-[#E2E8F0] px-2.5 py-2 shadow-neo-inset">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Vous revient à</p>
                  <p className="mt-0.5 font-display text-sm font-bold text-[#1E3A8A]">{formatFcfa(p.cout_de_revient_unitaire)}</p>
                  {p.frais_transport_attribues > 0 && (
                    <p className="text-[10px] text-[#64748B]">
                      +{formatFcfa(p.cout_de_revient_unitaire - Number(item.unit_price))} transport
                    </p>
                  )}
                </div>
                <label className="block rounded-xl border border-[#10B981]/40 bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] px-2.5 py-2 shadow-neo-card-subtle">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#047857]">
                    Vendez à{item.pv_manuel ? ' ✎' : ''}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={sellPrice || ''}
                    onChange={(e) => setManualSellPrice(i, e.target.value)}
                    className="mt-0.5 w-full bg-transparent font-display text-sm font-bold text-[#047857] outline-none"
                    aria-label={`Prix de vente conseillé pour ${item.product_name || 'cet article'}`}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <button type="button" className="text-xs text-red-600" onClick={() => removeItem(i)}>
                  Supprimer la ligne
                </button>
                {item.pv_manuel && (
                  <button type="button" className="text-xs font-semibold text-[#047857]" onClick={() => setManualSellPrice(i, '')}>
                    Revenir au prix conseillé ({formatFcfa(p.prix_de_vente_conseille)})
                  </button>
                )}
              </div>
              {belowCost && (
                <p className="text-xs font-semibold text-red-600">
                  Attention : à ce prix vous perdez de l’argent (l’article vous revient plus cher).
                </p>
              )}
            </Card>
          );
        })}

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
