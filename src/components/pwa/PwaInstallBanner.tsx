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
      <div className={`rounded-xl border border-[#1E3A8A]/20 bg-[#E2E8F0] ${compact ? 'p-2' : 'p-3'} text-xs text-[#0F172A]`}>
        Application installée sur cet appareil.
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] shadow-neo-card-subtle ${compact ? 'p-2' : 'p-3'}`}>
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#0F172A]">Installer efacture</p>
          <p className="text-[10px] text-[#64748B]">Accès rapide depuis l&apos;écran d&apos;accueil</p>
        </div>
        <Button type="button" onClick={onInstall} className="!w-auto shrink-0 !px-3 !py-2 !text-xs">
          Installer
        </Button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className={`rounded-xl border border-white/80 bg-gradient-to-br from-[#EEF2F6] to-[#E2E8F0] shadow-neo-card-subtle ${compact ? 'p-2' : 'p-3'} text-xs text-[#64748B]`}>
        <strong className="text-[#0F172A]">iPhone :</strong> Safari → partager{' '}
        <span className="inline-block rounded bg-[#CBD5E1] px-1 shadow-neo-inset">□↑</span> →{' '}
        <strong>Sur l&apos;écran d&apos;accueil</strong>
      </div>
    );
  }

  return null;
}
