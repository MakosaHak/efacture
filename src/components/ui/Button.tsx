import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'demo' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0284C7] text-white shadow-btn-electric border border-blue-400/40 hover:brightness-110 active:scale-[0.98]',
  secondary:
    'border border-[#1E3A8A]/30 text-[#1E3A8A] bg-[#E2E8F0] shadow-neo-inset hover:bg-[#DDE5EE] active:scale-[0.98]',
  demo: 'bg-[#E2E8F0] text-[#1E3A8A] shadow-neo-inset border border-white/80 hover:bg-[#DDE5EE] active:scale-[0.98]',
  danger: 'bg-gradient-to-r from-[#DC2626] to-[#B91C1C] text-white shadow-sm hover:brightness-110 active:scale-[0.98]',
};

export function Button({
  variant = 'primary',
  children,
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tracking-wide transition-all duration-150 disabled:opacity-50 ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
