/**
 * Petites illustrations vectorielles (style plat, palette de l'application)
 * pour remplacer les paragraphes d'explication : un dessin dit l'essentiel.
 */
export type IllustrationName = 'receipt' | 'scan' | 'basket' | 'chart' | 'wallet' | 'empty' | 'tags' | 'cloud';

const BLUE = '#2563eb';
const BLUE_SOFT = '#dbe7ff';
const INK = '#1f2937';
const PAPER = '#ffffff';
const LINE = '#cbd5e1';
const GREEN = '#15803d';
const GREEN_SOFT = '#dcfce7';
const AMBER = '#f59e0b';
const VIOLET_SOFT = '#ede9fe';
const VIOLET = '#6d28d9';

function Receipt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BLUE_SOFT} />
      <path d="M38 24h44v70l-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4L38 94V24z" fill={PAPER} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <rect x="46" y="36" width="28" height="4" rx="2" fill={INK} />
      <rect x="46" y="46" width="20" height="3" rx="1.5" fill={LINE} />
      <rect x="46" y="54" width="24" height="3" rx="1.5" fill={LINE} />
      <rect x="46" y="62" width="18" height="3" rx="1.5" fill={LINE} />
      <rect x="46" y="74" width="28" height="4" rx="2" fill={BLUE} />
      <circle cx="86" cy="86" r="14" fill={GREEN} />
      <path d="M79 86l5 5 9-10" stroke={PAPER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Scan({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BLUE_SOFT} />
      <rect x="30" y="28" width="60" height="64" rx="8" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="40" y="40" width="30" height="4" rx="2" fill={INK} />
      <rect x="40" y="50" width="40" height="3" rx="1.5" fill={LINE} />
      <rect x="40" y="58" width="36" height="3" rx="1.5" fill={LINE} />
      <rect x="40" y="66" width="40" height="3" rx="1.5" fill={LINE} />
      <path d="M24 44V30a6 6 0 016-6h14M96 44V30a6 6 0 00-6-6H76M24 76v14a6 6 0 006 6h14M96 76v14a6 6 0 01-6 6H76" stroke={BLUE} strokeWidth="4" strokeLinecap="round" />
      <rect x="22" y="58" width="76" height="4" rx="2" fill={BLUE} opacity="0.9" />
    </svg>
  );
}

function Basket({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={GREEN_SOFT} />
      <path d="M30 52h60l-6 36H36l-6-36z" fill={PAPER} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M44 52l10-20M76 52L66 32" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="26" y="48" width="68" height="8" rx="4" fill={GREEN} />
      <rect x="44" y="64" width="6" height="16" rx="3" fill={LINE} />
      <rect x="57" y="64" width="6" height="16" rx="3" fill={LINE} />
      <rect x="70" y="64" width="6" height="16" rx="3" fill={LINE} />
      <circle cx="88" cy="36" r="12" fill={AMBER} />
      <path d="M84 36h8M88 32v8" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Chart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={VIOLET_SOFT} />
      <rect x="28" y="28" width="64" height="64" rx="10" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="38" y="62" width="10" height="20" rx="3" fill={LINE} />
      <rect x="55" y="52" width="10" height="30" rx="3" fill={VIOLET} opacity="0.5" />
      <rect x="72" y="42" width="10" height="40" rx="3" fill={VIOLET} />
      <path d="M36 54l17-10 17 4 16-14" stroke={BLUE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="86" cy="34" r="4" fill={BLUE} />
    </svg>
  );
}

function Wallet({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BLUE_SOFT} />
      <rect x="26" y="40" width="68" height="48" rx="10" fill={BLUE} />
      <rect x="26" y="32" width="52" height="16" rx="6" fill={INK} opacity="0.85" />
      <rect x="66" y="56" width="28" height="18" rx="6" fill={PAPER} />
      <circle cx="80" cy="65" r="4" fill={BLUE} />
    </svg>
  );
}

function Empty({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill="#f1f5f9" />
      <rect x="34" y="36" width="52" height="56" rx="8" fill={PAPER} stroke={LINE} strokeWidth="2" strokeDasharray="6 5" />
      <rect x="46" y="50" width="28" height="4" rx="2" fill={LINE} />
      <rect x="46" y="60" width="20" height="4" rx="2" fill={LINE} />
      <circle cx="84" cy="84" r="12" fill={BLUE} />
      <path d="M84 78v12M78 84h12" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Tags({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={GREEN_SOFT} />
      <path d="M34 42a6 6 0 016-6h22l28 28-28 28-28-28V42z" fill={PAPER} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="48" cy="50" r="5" fill={GREEN} />
      <path d="M52 70l12-12" stroke={GREEN} strokeWidth="4" strokeLinecap="round" />
      <path d="M74 36l18 18" stroke={AMBER} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function Cloud({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BLUE_SOFT} />
      <path d="M40 80a14 14 0 01-2-27.8A20 20 0 0176 46a16 16 0 014 34H40z" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <path d="M60 72V54M52 62l8-8 8 8" stroke={BLUE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MAP = { receipt: Receipt, scan: Scan, basket: Basket, chart: Chart, wallet: Wallet, empty: Empty, tags: Tags, cloud: Cloud };

export function Illustration({ name, size = 112, className = '' }: { name: IllustrationName; size?: number; className?: string }) {
  const Comp = MAP[name];
  return (
    <div className={`inline-flex shrink-0 ${className}`}>
      <Comp size={size} />
    </div>
  );
}
