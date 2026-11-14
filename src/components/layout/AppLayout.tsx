import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from './BottomNav';

/**
 * Coque de l'application : colonne centrée façon téléphone, fond gris,
 * contenu blanc, navigation basse.
 */
export function AppLayout({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-bg sm:border-x sm:border-line">
        <main className={`flex-1 px-4 pt-3 ${hideNav ? 'pb-6' : 'pb-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+16px)]'}`}>
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
  action,
  subtitle,
}: {
  title: string;
  backTo?: string;
  action?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-4 mb-3 border-b border-line bg-bg/95 px-4 backdrop-blur">
      <div className="flex h-14 items-center gap-2">
        {backTo ? (
          <Link
            to={backTo}
            aria-label="Retour"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface"
          >
            <ChevronLeft size={22} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
