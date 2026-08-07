import { useNavigate } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/connexion');
  };

  return (
    <AppLayout>
      <AppHeader title="Profil" backTo="/" />

      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#006d41] text-2xl font-bold text-white">
          {(profile?.nom_commerce || user?.email || '?').charAt(0).toUpperCase()}
        </div>
        <h2 className="text-lg font-bold">{profile?.nom_commerce || 'Mon commerce'}</h2>
        <p className="text-sm text-[#6b7280]">{user?.email}</p>
      </div>

      <Card className="mb-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Téléphone</span>
          <span>{profile?.telephone || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Adresse</span>
          <span>{profile?.adresse || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Quartier</span>
          <span>{profile?.quartier || '—'}</span>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-semibold">Application</p>
        <PwaInstallBanner
          canInstall={canInstall}
          isInstalled={isInstalled}
          isIos={isIos}
          onInstall={() => install()}
        />
      </Card>

      <Card className="mb-4 opacity-60">
        <p className="text-sm font-semibold">Export PDF mensuel</p>
        <p className="text-xs text-[#6b7280]">Bientôt disponible</p>
      </Card>

      <Button variant="danger" fullWidth onClick={handleLogout}>
        Se déconnecter
      </Button>
    </AppLayout>
  );
}
