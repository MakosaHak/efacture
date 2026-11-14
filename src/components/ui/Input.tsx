import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
}

const control =
  'h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-2 disabled:text-muted read-only:bg-surface-2';

export function Field({ label, hint, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, trailing, className = '', ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="relative">
        <input className={`${control} ${trailing ? 'pr-11' : ''} ${error ? 'border-danger' : ''} ${className}`} {...props} />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>}
      </div>
    </Field>
  );
}

export function Select({ label, hint, error, className = '', children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      <select className={`${control} appearance-none bg-no-repeat pr-9 ${className}`} style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>")', backgroundPosition: 'right 12px center' }} {...props}>
        {children}
      </select>
    </Field>
  );
}
