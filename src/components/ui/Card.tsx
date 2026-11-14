import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md';
}

/** Surface blanche, bordure fine, ombre discrète. */
export function Card({ children, className = '', padding = 'md', ...props }: CardProps) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-3' : 'p-4';
  return (
    <div className={`rounded-card border border-line bg-surface shadow-card ${pad} ${className}`} {...props}>
      {children}
    </div>
  );
}

/** Titre de section (au-dessus d'une liste ou d'une carte). */
export function SectionTitle({
  children,
  action,
  className = '',
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-2 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
