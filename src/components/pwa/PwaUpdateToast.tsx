import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
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
    <div className="fixed bottom-[calc(var(--nav-height)+16px)] left-1/2 z-[100] w-[calc(100%-32px)] max-w-[408px] -translate-x-1/2 rounded-card border border-line bg-surface p-3 shadow-float">
      <div className="flex items-start gap-3">
        <RefreshCw size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Mise à jour disponible</p>
          <p className="text-xs text-muted">Une nouvelle version d’efacture est prête.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
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
          size="sm"
          variant="secondary"
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
