import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-xs font-semibold text-[#6b7280]">{label}</label>}
      <input
        className={`w-full rounded-xl border border-[#e8ecf0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#006d41] ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
