import { NavLink, useLocation } from 'react-router-dom';
import { Camera, Home, ReceiptText, Tags, UserRound, type LucideIcon } from 'lucide-react';

const items: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/factures', label: 'Reçus', icon: ReceiptText },
];

const itemsRight: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/prix-de-vente', label: 'Prix', icon: Tags },
  { to: '/profil', label: 'Compte', icon: UserRound },
];

function Item({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
          isActive ? 'text-primary' : 'text-muted hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  if (pathname === '/scanner') return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Navigation principale"
    >
      <div className="flex h-[var(--nav-height)] items-stretch">
        {items.map((it) => (
          <Item key={it.to} {...it} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <NavLink
            to="/scanner"
            aria-label="Scanner un reçu"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-float ring-4 ring-bg transition-transform active:scale-95"
          >
            <Camera size={24} />
          </NavLink>
        </div>
        {itemsRight.map((it) => (
          <Item key={it.to} {...it} />
        ))}
      </div>
    </nav>
  );
}
