import { useState } from 'react';
import { formatFcfa } from '../../lib/invoices';

/** Montant de référence pour expliquer la marge sans parler de pourcentage. */
const BASE = 1000;
const CHOICES = [10, 15, 20, 25, 30];

/**
 * Choix de la marge en langage simple : « j'achète à 1 000 F, je revends à … ».
 * La valeur reste stockée en % (chaîne).
 */
export function MarginPicker({ value, onChange, title }: { value: string; onChange: (pct: string) => void; title?: string }) {
  const pct = parseFloat(value);
  const valid = Number.isFinite(pct) && pct >= 0;
  const resale = valid ? Math.round(BASE * (1 + pct / 100)) : 0;
  const isChoice = CHOICES.includes(pct);
  const [custom, setCustom] = useState(() => (valid && !isChoice ? String(resale) : ''));
  const customShown = isChoice ? '' : custom || (valid ? String(resale) : '');

  return (
    <div className="w-full">
      {title ? <p className="mb-1 text-[13px] font-medium text-ink-2">{title}</p> : null}
      <p className="mb-2 text-[13px] text-muted">
        Un article acheté <strong className="text-ink">{formatFcfa(BASE)}</strong>, vous le revendez à :
      </p>

      <div className="grid grid-cols-3 gap-2">
        {CHOICES.map((c) => {
          const active = valid && pct === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCustom('');
                onChange(String(c));
              }}
              className={`rounded-control border px-2 py-2 text-center transition-colors ${
                active ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-surface-2'
              }`}
              aria-pressed={active}
            >
              <span className={`block text-sm font-semibold ${active ? 'text-primary-ink' : 'text-ink'}`}>
                {formatFcfa(BASE * (1 + c / 100))}
              </span>
              <span className={`block text-[11px] ${active ? 'text-primary' : 'text-muted'}`}>
                gain {formatFcfa((BASE * c) / 100)}
              </span>
            </button>
          );
        })}
        <label
          className={`flex flex-col justify-center rounded-control border px-2 py-1.5 text-center ${
            customShown ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
          }`}
        >
          <span className="text-[11px] text-muted">Autre prix</span>
          <input
            type="number"
            min={BASE}
            step={50}
            inputMode="numeric"
            placeholder="1 400"
            value={customShown}
            onChange={(e) => {
              setCustom(e.target.value);
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v >= BASE) onChange(String(Math.round(((v - BASE) / BASE) * 1000) / 10));
            }}
            className="w-full bg-transparent text-center text-sm font-semibold text-ink outline-none placeholder:text-faint"
            aria-label="Autre prix de revente pour 1000 F d'achat"
          />
        </label>
      </div>

      {valid && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Sur chaque <strong className="text-ink">{formatFcfa(BASE)}</strong> d’achat, vous gagnez{' '}
          <strong className="text-ink">{formatFcfa(resale - BASE)}</strong> (marge de {pct.toLocaleString('fr-FR')} %).
        </p>
      )}
    </div>
  );
}
