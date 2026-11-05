import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const customBg = /(^|\s)(bg-\[|bg-gradient|from-\[)/.test(className);
  const customBorder = /(^|\s)border(-|\[|0)/.test(className);
  return (
    <div
      className={`rounded-2xl p-4 shadow-neo-card ${customBg ? '' : 'bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0]'} ${customBorder ? 'border' : 'border border-white/80'} ${className}`}
    >
      {children}
    </div>
  );
}
