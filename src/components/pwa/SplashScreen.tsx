import { useEffect, useState } from 'react';

const SPLASH_KEY = 'efacture-splash-seen';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY) === '1') {
      document.getElementById('boot-splash')?.remove();
      onDone();
      setVisible(false);
      return;
    }
    sessionStorage.setItem(SPLASH_KEY, '1');
    const fadeTimer = setTimeout(() => setFade(true), 1200);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 1600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg transition-opacity duration-400 ${fade ? 'opacity-0' : 'opacity-100'}`}
      role="presentation"
    >
      <img src="/icons/logo.png" alt="efacture" className="mb-5 h-24 w-auto object-contain" />
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        <span className="text-primary">e</span>facture
      </h1>
      <p className="mt-1 text-sm text-muted">Scanner et gérer vos achats</p>
    </div>
  );
}
