import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../context/AuthContext';

export function AppLayout({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  const { isLocalDemo } = useAuth();

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col border-x border-[#CBD5E1] bg-gradient-to-b from-[#E2E8F0] via-[#DCE5EF] to-[#D5DFEC] shadow-2xl">
        {isLocalDemo && (
          <aside className="relative w-full overflow-hidden border-b border-[#1E293B] bg-[#0F172A] px-3 py-2.5 text-center text-[11px] font-medium tracking-wide text-[#E2E8F0]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
            <span className="inline-flex items-center gap-2 opacity-95">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]" />
              Mode démo local — données fictives (Supabase non requis)
            </span>
          </aside>
        )}
        <main className={`flex-1 px-5 pt-4 ${hideNav ? 'pb-4' : 'pb-28'}`}>
          {children}
        </main>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}

export function AppHeader({
  title,
  backTo,
}: {
  title: string;
  backTo?: string;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-4 border-b border-white/70 bg-[#E2E8F0]/90 px-5 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-[#E2E8F0] text-[#1E3A8A] shadow-neo-card-subtle"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 text-center text-base font-bold tracking-tight text-[#0F172A]">{title}</h1>
        {backTo && <div className="w-10" />}
      </div>
    </header>
  );
}
