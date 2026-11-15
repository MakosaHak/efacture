import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, type LucideIcon, XCircle } from 'lucide-react';
import { Illustration, type IllustrationName } from './Illustration';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const tones: Record<Tone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: 'bg-primary-soft text-primary-ink border-primary/10', icon: Info, iconClass: 'text-primary' },
  success: { box: 'bg-success-soft text-success border-success/10', icon: CheckCircle2, iconClass: 'text-success' },
  warning: { box: 'bg-warning-soft text-warning border-warning/10', icon: AlertTriangle, iconClass: 'text-warning' },
  danger: { box: 'bg-danger-soft text-danger border-danger/10', icon: XCircle, iconClass: 'text-danger' },
  neutral: { box: 'bg-surface-2 text-ink-2 border-line', icon: Info, iconClass: 'text-muted' },
};

/** Message contextuel (information, avertissement, erreur…). */
export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div className={`flex gap-2.5 rounded-control border px-3 py-2.5 text-[13px] leading-relaxed ${t.box} ${className}`} role="status">
      <Icon size={18} className={`mt-0.5 shrink-0 ${t.iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

const badgeTones: Record<Tone, string> = {
  info: 'bg-primary-soft text-primary-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-2 text-muted border border-line',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`} role="status" aria-label="Chargement">
      <div className="h-8 w-8 rounded-full border-[3px] border-line border-t-primary" style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  text,
  action,
}: {
  icon?: LucideIcon;
  illustration?: IllustrationName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface px-5 py-8 text-center shadow-card">
      {illustration ? (
        <Illustration name={illustration} size={120} className="mb-3" />
      ) : Icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon size={22} />
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export type TileTone = 'neutral' | 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'teal';

const tileTones: Record<TileTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  blue: 'bg-primary-soft text-primary',
  green: 'bg-success-soft text-success',
  amber: 'bg-amber-soft text-amber',
  violet: 'bg-violet-soft text-violet',
  rose: 'bg-rose-soft text-rose',
  teal: 'bg-teal-soft text-teal',
};

/** Pastille carrée colorée autour d'une icône. */
export function IconTile({ icon: Icon, tone = 'neutral', size = 40 }: { icon: LucideIcon; tone?: TileTone; size?: number }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-[12px] ${tileTones[tone]}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.47)} />
    </div>
  );
}

/** Ligne cliquable (icône, texte, chevron) pour listes et menus. */
export function ListRow({
  icon: Icon,
  tone = 'neutral',
  title,
  subtitle,
  trailing,
  className = '',
}: {
  icon?: LucideIcon;
  tone?: TileTone;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {Icon && <IconTile icon={Icon} tone={tone} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}
