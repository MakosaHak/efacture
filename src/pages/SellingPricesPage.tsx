import { useCallback, useEffect, useState } from 'react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { formatFcfa } from '../lib/invoices';
import {
  acceptAllSuggestions,
  confirmSellingPrice,
  getDefaultMargin,
  listPriceSuggestions,
} from '../lib/productPrices';
import { PRICE_STEP } from '../lib/pricing';
import type { PriceSuggestion } from '../types/invoice';

const pct = (m: number) => `${(m * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

export default function SellingPricesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PriceSuggestion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [defaultMargin, setDefaultMargin] = useState(0.15);
  const [showKnown, setShowKnown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const [list, margin] = await Promise.all([listPriceSuggestions(), getDefaultMargin()]);
    setRows(list);
    setDefaultMargin(margin);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    reload().catch((err) => {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
      setLoading(false);
    });
  }, [user, reload]);

  const priceOf = (r: PriceSuggestion) => {
    const d = drafts[r.product_key];
    return d == null || d.trim() === '' ? r.suggested_price : Math.max(0, parseFloat(d) || 0);
  };

  const run = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    setError('');
    try {
      setMessage(await action());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(null);
    }
  };

  const confirmOne = (r: PriceSuggestion) =>
    run(r.product_key, async () => {
      const price = priceOf(r);
      const { margin, learned } = await confirmSellingPrice(r.product_key, price);
      setDrafts(({ [r.product_key]: _done, ...rest }) => rest);
      const before = r.margin ?? defaultMargin;
      return learned && margin != null
        ? `${r.product_name} : ${formatFcfa(price)} enregistré. Marge du produit ${pct(before)} → ${pct(margin)}.`
        : `${r.product_name} : ${formatFcfa(price)} enregistré (sous le prix d'achat : marge non modifiée).`;
    });

  const acceptAll = () =>
    run('*', async () => {
      // Une ligne modifiée garde le prix saisi ; les autres sont acceptées au prix suggéré.
      const edited = rows.filter((r) => drafts[r.product_key]?.trim());
      for (const r of edited) await confirmSellingPrice(r.product_key, priceOf(r));
      const rest = rows.filter((r) => !edited.includes(r)).map((r) => r.product_key);
      await acceptAllSuggestions(rest);
      setDrafts({});
      return `${rows.length} prix de vente enregistré${rows.length > 1 ? 's' : ''}.`;
    });

  const toReview = rows.filter((r) => r.needs_review);
  const known = rows.filter((r) => !r.needs_review);

  const renderRow = (r: PriceSuggestion) => {
    const price = priceOf(r);
    const belowCost = price > 0 && price < r.last_purchase_price;
    return (
      <Card key={r.product_key} className="mb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-[#0F172A]">{r.product_name}</p>
          {r.is_increase ? (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Prix d'achat en hausse
            </span>
          ) : r.is_new ? (
            <span className="shrink-0 rounded-full border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-2 py-0.5 text-[10px] font-bold text-[#0E7490]">
              Nouveau produit
            </span>
          ) : null}
        </div>

        <p className="text-xs text-[#64748B]">
          Prix d'achat :{' '}
          {r.is_increase && r.previous_purchase_price != null ? (
            <>
              <span className="line-through">{formatFcfa(r.previous_purchase_price)}</span> →{' '}
              <strong className="text-red-700">{formatFcfa(r.last_purchase_price)}</strong>
            </>
          ) : (
            <strong className="text-[#0F172A]">{formatFcfa(r.last_purchase_price)}</strong>
          )}
          {' · '}marge {pct(r.margin ?? defaultMargin)} {r.margin == null ? '(habituelle)' : '(apprise)'}
        </p>

        <div className="flex items-end gap-2">
          <label className="flex-1 rounded-xl border border-[#10B981]/40 bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] px-3 py-2 shadow-neo-card-subtle">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#047857]">
              Prix de vente suggéré (FCFA)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={PRICE_STEP}
              value={drafts[r.product_key] ?? String(r.suggested_price)}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.product_key]: e.target.value }))}
              className="w-full bg-transparent font-display text-lg font-bold text-[#047857] outline-none"
              aria-label={`Prix de vente pour ${r.product_name}`}
            />
          </label>
          <Button type="button" className="!px-3" disabled={busy !== null} onClick={() => confirmOne(r)}>
            {busy === r.product_key ? '…' : 'Confirmer'}
          </Button>
        </div>

        {belowCost && (
          <p className="text-xs font-semibold text-red-600">
            Attention : ce prix est inférieur au prix d'achat ({formatFcfa(r.last_purchase_price)}). Vous perdez de
            l'argent sur cet article.
          </p>
        )}
      </Card>
    );
  };

  return (
    <AppLayout>
      <AppHeader title="Prix de vente" backTo="/" />

      <p className="mb-4 text-xs leading-relaxed text-[#64748B]">
        Prix proposés à partir de vos derniers achats et de votre marge. Confirmez ou corrigez : l'application
        retient vos choix pour mieux proposer la prochaine fois.
      </p>

      {message && (
        <p className="mb-3 rounded-xl bg-[#ECFDF5] px-3 py-2 text-xs font-medium text-[#065F46]">✓ {message}</p>
      )}
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center text-sm text-[#64748B]">Aucun prix à confirmer</Card>
      ) : (
        <div className="pb-20">
          {toReview.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                <span className="h-2 w-2 rounded-full bg-[#D97706] shadow-[0_0_6px_#F59E0B]" />À vérifier ({toReview.length})
              </h2>
              {toReview.map(renderRow)}
            </section>
          )}

          {known.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowKnown((v) => !v)}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/70 bg-[#E2E8F0] px-3 py-2.5 text-sm font-bold text-[#0F172A] shadow-neo-inset"
                aria-expanded={showKnown}
              >
                <span>Déjà connus ({known.length})</span>
                <span className="text-[#64748B]">{showKnown ? '▲' : '▼'}</span>
              </button>
              {showKnown && known.map(renderRow)}
            </section>
          )}

          <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 px-5">
            <Button type="button" fullWidth disabled={busy !== null} onClick={acceptAll}>
              {busy === '*' ? 'Enregistrement…' : `Tout accepter (${rows.length})`}
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
