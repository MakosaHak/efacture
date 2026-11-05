import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#64748B]">{label}</label>}
      <input
        className={`w-full rounded-xl border border-white/80 bg-[#E2E8F0] px-3 py-2.5 text-sm text-[#0F172A] shadow-neo-inset outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB]/50 focus:ring-2 focus:ring-[#2563EB]/20 ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
