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
    <div className="min-h-dvh bg-[#f4f6f8]">
      {isLocalDemo && (
        <div className="sticky top-0 z-50 bg-[#006d41] px-4 py-2 text-center text-xs font-medium text-white">
          Mode démo local — données fictives (Supabase non requis)
        </div>
      )}
      <main
        className={`mx-auto w-full max-w-[480px] px-4 pt-4 ${hideNav ? 'pb-4' : 'pb-[calc(72px+1.5rem)]'}`}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
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
    <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-[#e8ecf0] bg-white px-4">
      <div className="flex h-14 items-center gap-3">
        {backTo && (
          <Link to={backTo} className="flex h-10 w-10 items-center justify-center rounded-full text-[#006d41]">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 text-center text-base font-bold text-[#006d41]">{title}</h1>
        {backTo && <div className="w-10" />}
      </div>
    </header>
  );
}
