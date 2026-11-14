import { Share, Smartphone } from 'lucide-react';
import { Button } from '../ui/Button';

interface PwaInstallBannerProps {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  onInstall: () => void;
}

export function PwaInstallBanner({ canInstall, isInstalled, isIos, onInstall }: PwaInstallBannerProps) {
  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-line bg-surface-2 p-3 text-[13px] text-ink-2">
        <Smartphone size={18} className="shrink-0 text-muted" />
        Application installée sur cet appareil.
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-line bg-surface p-3">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-[10px] object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">Installer efacture</p>
          <p className="text-xs text-muted">Accès direct depuis l’écran d’accueil</p>
        </div>
        <Button type="button" size="sm" onClick={onInstall}>
          Installer
        </Button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className="flex items-start gap-3 rounded-control border border-line bg-surface p-3 text-[13px] text-ink-2">
        <Share size={18} className="mt-0.5 shrink-0 text-muted" />
        <p>
          Sur iPhone : dans Safari, touchez <strong>Partager</strong> puis <strong>Sur l’écran d’accueil</strong>.
        </p>
      </div>
    );
  }

  return null;
}
