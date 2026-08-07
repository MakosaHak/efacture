import { NavLink, useLocation } from 'react-router-dom';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-0.5 text-[10px] font-medium ${isActive ? 'text-[#006d41]' : 'text-[#6b7280]'}`;

export function BottomNav() {
  const location = useLocation();
  const isScanner = location.pathname === '/scanner';

  if (isScanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8ecf0] bg-white">
      <nav className="relative mx-auto flex max-w-[480px] items-end justify-around px-2 pb-2 pt-1">
        <NavLink to="/" className={navClass} end>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
          </svg>
          Home
        </NavLink>

        <NavLink to="/factures" className={navClass}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </NavLink>

        <NavLink
          to="/scanner"
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-4 items-center justify-center rounded-full bg-[#006d41] text-white shadow-lg"
          aria-label="Scanner"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </NavLink>

        <div className="w-14" />

        <NavLink to="/stats/prix" className={navClass}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Stats
        </NavLink>

        <NavLink to="/profil" className={navClass}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profile
        </NavLink>
      </nav>
    </div>
  );
}
