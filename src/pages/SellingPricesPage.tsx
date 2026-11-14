import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Tags } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Notice, Spinner } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatFcfa } from '../lib/invoices';
import {
  acceptAllSuggestions,
  confirmSellingPrice,
  getDefaultMargin,
  listAllProductPrices,
  listPriceSuggestions,
} from '../lib/productPrices';
import { PRICE_STEP } from '../lib/pricing';
import type { PriceSuggestion, ProductPrice } from '../types/invoice';

const pct = (m: number) => `${(m * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

export default function SellingPricesPage() {
  const { user, dataVersion } = useAuth();
  const [rows, setRows] = useState<PriceSuggestion[]>([]);
  const [confirmed, setConfirmed] = useState<ProductPrice[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [defaultMargin, setDefaultMargin] = useState(0.15);
  const [showKnown, setShowKnown] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!user) return;
    const [list, margin, all] = await Promise.all([listPriceSuggestions(user.id), getDefaultMargin(user.id), listAllProductPrices(user.id)]);
    setRows(list);
    setDefaultMargin(margin);
    setConfirmed(all.filter((r) => r.status === 'confirmed'));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload().catch((err) => {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
      setLoading(false);
    });
  }, [reload, dataVersion]);

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
      if (!user) throw new Error('Non connecté.');
      const price = priceOf(r);
      const { margin, learned } = await confirmSellingPrice(user.id, r.product_key, price);
      setDrafts(({ [r.product_key]: _done, ...rest }) => rest);
      const before = r.margin ?? defaultMargin;
      return learned && margin != null
        ? `${r.product_name} : ${formatFcfa(price)} enregistré. Marge ${pct(before)} → ${pct(margin)}.`
        : `${r.product_name} : ${formatFcfa(price)} enregistré (sous le prix d’achat, marge inchangée).`;
    });

  const acceptAll = () =>
    run('*', async () => {
      if (!user) throw new Error('Non connecté.');
      const edited = rows.filter((r) => drafts[r.product_key]?.trim());
      for (const r of edited) await confirmSellingPrice(user.id, r.product_key, priceOf(r));
      const rest = rows.filter((r) => !edited.includes(r)).map((r) => r.product_key);
      await acceptAllSuggestions(user.id, rest);
      setDrafts({});
      return `${rows.length} prix de vente enregistré${rows.length > 1 ? 's' : ''}.`;
    });

  const toReview = rows.filter((r) => r.needs_review);
  const known = rows.filter((r) => !r.needs_review);

  const renderRow = (r: PriceSuggestion) => {
    const price = priceOf(r);
    const belowCost = price > 0 && price < r.last_purchase_price;
    return (
      <Card key={r.product_key} className="mb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold text-ink">{r.product_name}</p>
          {r.is_increase ? <Badge tone="warning">Achat en hausse</Badge> : r.is_new ? <Badge tone="info">Nouveau</Badge> : null}
        </div>

        <p className="text-[13px] text-muted">
          Acheté{' '}
          {r.is_increase && r.previous_purchase_price != null ? (
            <>
              <span className="line-through">{formatFcfa(r.previous_purchase_price)}</span> puis <strong className="text-ink">{formatFcfa(r.last_purchase_price)}</strong>
            </>
          ) : (
            <strong className="text-ink">{formatFcfa(r.last_purchase_price)}</strong>
          )}
          {' · '}marge {pct(r.margin ?? defaultMargin)} {r.margin == null ? '(habituelle)' : '(apprise)'}
        </p>

        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Prix de vente (FCFA)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={PRICE_STEP}
              value={drafts[r.product_key] ?? String(r.suggested_price)}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.product_key]: e.target.value }))}
              className="h-11 w-full rounded-control border border-line bg-surface px-3 text-lg font-semibold text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              aria-label={`Prix de vente pour ${r.product_name}`}
            />
          </label>
          <Button type="button" disabled={busy !== null} loading={busy === r.product_key} onClick={() => confirmOne(r)}>
            Confirmer
          </Button>
        </div>

        {belowCost && (
          <Notice tone="danger">Ce prix est inférieur au prix d’achat ({formatFcfa(r.last_purchase_price)}) : vous perdriez de l’argent.</Notice>
        )}
      </Card>
    );
  };

  return (
    <AppLayout>
      <AppHeader title="Prix de vente" subtitle="Proposés d’après vos achats et votre marge" />

      {message && (
        <Notice tone="success" className="mb-3">
          {message}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" className="mb-3">
          {error}
        </Notice>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className={rows.length ? 'pb-24' : ''}>
          {rows.length === 0 && (
            <div className="mb-5">
              <EmptyState icon={Tags} title="Aucun prix à confirmer" text="Après chaque reçu validé, un prix de vente vous est proposé pour chaque article." />
            </div>
          )}

          {toReview.length > 0 && (
            <section className="mb-4">
              <SectionTitle>À vérifier ({toReview.length})</SectionTitle>
              {toReview.map(renderRow)}
            </section>
          )}

          {known.length > 0 && (
            <section className="mb-4">
              <button
                type="button"
                onClick={() => setShowKnown((v) => !v)}
                className="mb-2 flex w-full items-center justify-between rounded-control border border-line bg-surface px-3 py-2.5 text-[15px] font-semibold text-ink"
                aria-expanded={showKnown}
              >
                <span>Déjà connus ({known.length})</span>
                {showKnown ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
              </button>
              {showKnown && known.map(renderRow)}
            </section>
          )}

          {confirmed.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowConfirmed((v) => !v)}
                className="mb-2 flex w-full items-center justify-between text-left"
                aria-expanded={showConfirmed}
              >
                <h2 className="text-[15px] font-semibold text-ink">Mes prix confirmés ({confirmed.length})</h2>
                {showConfirmed ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
              </button>
              {showConfirmed && (
                <Card padding="none" className="divide-y divide-line">
                  {confirmed.map((p) => (
                    <div key={p.product_key} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-ink">{p.product_name}</p>
                        <p className="text-[13px] text-muted">
                          Acheté {formatFcfa(p.last_purchase_price)} · marge {pct(p.margin ?? defaultMargin)} · {formatDate(p.updated_at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[15px] font-semibold text-ink">{formatFcfa(p.selling_price ?? p.suggested_price)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          )}

          {rows.length > 0 && (
            <div className="fixed bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+12px)] left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 px-4">
              <Button type="button" fullWidth size="lg" className="shadow-float" disabled={busy !== null} loading={busy === '*'} onClick={acceptAll}>
                Tout accepter ({rows.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
