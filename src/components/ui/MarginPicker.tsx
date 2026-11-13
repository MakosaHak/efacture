import { useState } from 'react';
import { formatFcfa } from '../../lib/invoices';

/** Montant de référence pour expliquer la marge sans parler de pourcentage. */
const BASE = 1000;
const CHOICES = [10, 15, 20, 25, 30];

/**
 * Choix de la marge en langage simple : « j'achète à 1 000 F, je revends à … ».
 * La valeur reste stockée en % (chaîne) pour le calcul du prix de vente conseillé.
 */
export function MarginPicker({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (pct: string) => void;
  title?: string;
}) {
  const pct = parseFloat(value);
  const valid = Number.isFinite(pct) && pct >= 0;
  const resale = valid ? Math.round(BASE * (1 + pct / 100)) : 0;
  const isChoice = CHOICES.includes(pct);
  // saisie libre : gardée telle quelle pendant la frappe (« 1 », « 14 », « 140 »…)
  const [custom, setCustom] = useState(() => (valid && !isChoice ? String(resale) : ''));
  const customShown = isChoice ? '' : custom || (valid ? String(resale) : '');

  return (
    <div className="w-full">
      {title ? (
        <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">{title}</p>
      ) : null}
      <p className="mb-2 text-xs text-[#475569]">
        Un article que vous achetez <strong className="text-[#0F172A]">{formatFcfa(BASE)}</strong>, vous voulez le
        revendre à :
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
              className={`rounded-xl px-2 py-2 text-center transition-all active:scale-95 ${
                active
                  ? 'border border-[#10B981] bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] shadow-neo-card-subtle'
                  : 'border border-white/70 bg-[#E2E8F0] shadow-neo-inset'
              }`}
            >
              <span className={`block font-display text-sm font-bold ${active ? 'text-[#047857]' : 'text-[#0F172A]'}`}>
                {formatFcfa(BASE * (1 + c / 100))}
              </span>
              <span className={`block text-[10px] font-semibold ${active ? 'text-[#059669]' : 'text-[#64748B]'}`}>
                vous gagnez {formatFcfa((BASE * c) / 100)}
              </span>
            </button>
          );
        })}
        <label
          className={`flex flex-col justify-center rounded-xl px-2 py-1.5 text-center ${
            customShown
              ? 'border border-[#10B981] bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5]'
              : 'border border-white/70 bg-[#E2E8F0] shadow-neo-inset'
          }`}
        >
          <span className="text-[10px] font-semibold text-[#64748B]">Autre prix</span>
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
            className="w-full bg-transparent text-center font-display text-sm font-bold text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            aria-label="Autre prix de revente pour 1000 F d'achat"
          />
        </label>
      </div>

      {valid && (
        <p className="mt-2 rounded-xl bg-[#ECFDF5] px-3 py-2 text-xs leading-relaxed text-[#065F46]">
          ✓ Sur chaque <strong>{formatFcfa(BASE)}</strong> d’achat, vous gagnez{' '}
          <strong>{formatFcfa(resale - BASE)}</strong> (marge de {pct.toLocaleString('fr-FR')} %). L’application
          vous propose ensuite un prix de vente pour chaque article acheté.
        </p>
      )}
    </div>
  );
}
