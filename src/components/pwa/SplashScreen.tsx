import { useEffect, useState } from 'react';

const SPLASH_KEY = 'efacture-splash-seen';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_KEY);
    if (seen === '1') {
      document.getElementById('boot-splash')?.remove();
      onDone();
      setVisible(false);
      return;
    }

    sessionStorage.setItem(SPLASH_KEY, '1');
    const fadeTimer = setTimeout(() => setFade(true), 1800);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-[#E2E8F0] via-[#DCE5EF] to-[#D5DFEC] transition-opacity duration-500 ${fade ? 'opacity-0' : 'opacity-100'}`}
      role="presentation"
    >
      <img
        src="/icons/logo.png"
        alt="efacture"
        className="mb-6 h-28 w-auto aspect-[612/408] object-contain"
      />
      <h1 className="mb-2 font-display text-3xl font-bold tracking-tight">
        <span className="text-[#2563EB]">e</span>
        <span className="text-[#0F172A]">facture</span>
      </h1>
      <p className="max-w-[280px] text-center text-sm font-medium text-[#1E3A8A]">
        Scanner &amp; Gérer Vos Achats au Togo
      </p>
      <div className="mt-10 h-1.5 w-16 overflow-hidden rounded-full bg-[#CBD5E1] shadow-neo-inset">
        <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4]" style={{ width: '70%' }} />
      </div>
    </div>
  );
}
