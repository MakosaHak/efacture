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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${fade ? 'opacity-0' : 'opacity-100'}`}
      role="presentation"
    >
      <img
        src="/icons/logo.png"
        alt="efacture"
        className="mb-6 h-28 w-auto aspect-[612/408] object-contain"
      />
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        <span className="text-[#006d41]">e</span>
        <span className="text-[#1e3a5f]">facture</span>
      </h1>
      <p className="max-w-[280px] text-center text-sm font-medium text-[#1e3a5f]">
        Scanner &amp; Gérer Vos Achats au Togo
      </p>
      <div className="mt-10 h-1 w-16 overflow-hidden rounded-full bg-[#e8f5ee]">
        <div className="h-full animate-pulse rounded-full bg-[#006d41]" style={{ width: '70%' }} />
      </div>
    </div>
  );
}
