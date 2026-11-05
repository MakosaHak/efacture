import { NavLink, useLocation } from 'react-router-dom';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center justify-center transition-colors ${
    isActive ? 'text-[#1E3A8A]' : 'text-[#64748B] hover:text-[#0F172A]'
  }`;

const labelClass = (isActive: boolean) =>
  `mt-1 text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`;

export function BottomNav() {
  const location = useLocation();
  const isScanner = location.pathname === '/scanner';

  if (isScanner) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 border-t border-white/80 bg-[#E2E8F0]/95 pb-[env(safe-area-inset-bottom,0px)] shadow-nav-neo backdrop-blur-md">
      <div className="relative flex h-16 items-center justify-around px-2">
        <NavLink to="/" className={navClass} end>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className={labelClass(isActive)}>Accueil</span>
            </>
          )}
        </NavLink>

        <NavLink to="/factures" className={navClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={labelClass(isActive)}>Journal</span>
            </>
          )}
        </NavLink>

        <div className="flex flex-1 flex-col items-center justify-center">
          <NavLink
            to="/scanner"
            aria-label="Scanner une facture"
            className="-mt-7 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-tr from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white shadow-floating-cam ring-4 ring-[#E2E8F0] transition-transform duration-150 active:scale-95"
          >
            <svg className="h-6 w-6 stroke-[1.9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavLink>
        </div>

        <NavLink to="/stats/prix" className={navClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className={labelClass(isActive)}>Analyses</span>
            </>
          )}
        </NavLink>

        <NavLink to="/profil" className={navClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className={labelClass(isActive)}>Compte</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
