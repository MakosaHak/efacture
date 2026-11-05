import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';

export function PwaUpdateToast() {
  const [visible, setVisible] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) setVisible(true);
  }, [needRefresh]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-[440px] rounded-2xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] p-3 shadow-neo-card">
      <p className="mb-2 text-sm font-semibold text-[#0F172A]">Mise à jour disponible</p>
      <p className="mb-3 text-xs text-[#64748B]">Une nouvelle version d&apos;efacture est prête.</p>
      <div className="flex gap-2">
        <Button
          type="button"
          className="!py-2 !text-xs"
          onClick={() => {
            updateServiceWorker(true);
            setNeedRefresh(false);
            setVisible(false);
          }}
        >
          Mettre à jour
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!py-2 !text-xs"
          onClick={() => {
            setNeedRefresh(false);
            setVisible(false);
          }}
        >
          Plus tard
        </Button>
      </div>
    </div>
  );
}
