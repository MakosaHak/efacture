import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface WheelItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Couleur de fond du secteur et couleur de l'icône / du texte. */
  fill: string;
  ink: string;
  /** Petite valeur affichée sous le libellé (facultatif). */
  value?: string;
}

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 2;
const HUB = 46;
const GAP = 6;

function polar(angleDeg: number, radius: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

/** Secteur annulaire entre `r0` (trou central) et `r1`, de `a0` à `a1` degrés. */
function sectorPath(a0: number, a1: number, r0: number, r1: number): string {
  const [x1, y1] = polar(a0, r1);
  const [x2, y2] = polar(a1, r1);
  const [x3, y3] = polar(a1, r0);
  const [x4, y4] = polar(a0, r0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x4} ${y4} Z`;
}

/**
 * Trois boutons qui forment ensemble un cercle : chaque part fait un tiers
 * du disque et mène à un écran d'analyse. La roue prend toute la largeur
 * disponible (jusqu'à 320 px) ; les textes sont placés au centre de chaque part.
 */
export function AnalysisWheel({ items, hubLabel = 'Analyses' }: { items: [WheelItem, WheelItem, WheelItem]; hubLabel?: string }) {
  const navigate = useNavigate();
  const step = 360 / items.length;
  const pct = (v: number) => `${(v / SIZE) * 100}%`;

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: SIZE, aspectRatio: '1 / 1' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block h-full w-full" role="group" aria-label={hubLabel}>
        {items.map((it, i) => {
          const a0 = i * step;
          const a1 = a0 + step;
          return (
            <path
              key={it.to}
              d={sectorPath(a0, a1, HUB + GAP, R)}
              fill={it.fill}
              stroke="#ffffff"
              strokeWidth={5}
              strokeLinejoin="round"
              className="cursor-pointer outline-none transition-[filter] duration-150 hover:brightness-[0.97] active:brightness-95 focus-visible:brightness-95"
              role="link"
              tabIndex={0}
              aria-label={it.label}
              onClick={() => navigate(it.to)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(it.to);
                }
              }}
            />
          );
        })}
        <circle cx={CX} cy={CY} r={HUB} fill="#2563eb" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#ffffff" fontFamily="inherit">
          {hubLabel}
        </text>
      </svg>

      {/* Icônes et libellés au centre de chaque part (non cliquables : le clic passe au secteur). */}
      {items.map((it, i) => {
        const mid = i * step + step / 2;
        const [x, y] = polar(mid, HUB + GAP + (R - HUB - GAP) * 0.56);
        const Icon = it.icon;
        return (
          <div
            key={it.to}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            style={{ left: pct(x), top: pct(y), width: pct(104), color: it.ink }}
          >
            <Icon size={24} strokeWidth={1.9} />
            <span className="mt-1 text-[11.5px] font-semibold leading-[1.15]">{it.label}</span>
            {it.value && <span className="mt-0.5 text-[10.5px] font-medium opacity-80">{it.value}</span>}
          </div>
        );
      })}
    </div>
  );
}
