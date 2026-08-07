import { Button } from '../ui/Button';

interface PwaInstallBannerProps {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  onInstall: () => void;
  compact?: boolean;
}

export function PwaInstallBanner({
  canInstall,
  isInstalled,
  isIos,
  onInstall,
  compact = false,
}: PwaInstallBannerProps) {
  if (isInstalled) {
    return (
      <div className={`rounded-xl border border-[#006d41]/20 bg-[#e8f5ee] ${compact ? 'p-2' : 'p-3'} text-xs text-[#005533]`}>
        Application installée sur cet appareil.
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-[#e8ecf0] bg-white ${compact ? 'p-2' : 'p-3'}`}>
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#1a1f2e]">Installer efacture</p>
          <p className="text-[10px] text-[#6b7280]">Accès rapide depuis l&apos;écran d&apos;accueil</p>
        </div>
        <Button type="button" onClick={onInstall} className="!w-auto shrink-0 !px-3 !py-2 !text-xs">
          Installer
        </Button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className={`rounded-xl border border-[#e8ecf0] bg-white ${compact ? 'p-2' : 'p-3'} text-xs text-[#6b7280]`}>
        <strong className="text-[#1a1f2e]">iPhone :</strong> Safari → partager{' '}
        <span className="inline-block rounded bg-[#f4f6f8] px-1">□↑</span> →{' '}
        <strong>Sur l&apos;écran d&apos;accueil</strong>
      </div>
    );
  }

  return null;
}
