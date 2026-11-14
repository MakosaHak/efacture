import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-strong active:bg-primary-strong',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 active:bg-surface-2',
  ghost: 'bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft',
  danger: 'bg-danger-soft text-danger border border-danger/15 hover:bg-red-100 active:bg-red-100',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-[10px] gap-1.5',
  md: 'h-11 px-4 text-sm rounded-control gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-control gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: 'spin 0.8s linear infinite' }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
