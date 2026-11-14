import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Notice } from '../components/ui/Feedback';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';

export default function LoginPage() {
  const { user, loading: authLoading, signInWithPhonePassword } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) return <Navigate to="/" replace />;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithPhonePassword(phone, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-dvh bg-bg px-5 pb-8 pt-10">
      <div className="mx-auto max-w-[400px]">
        <div className="mb-8 text-center">
          <img src="/icons/logo.png" alt="" className="mx-auto mb-3 h-16 w-auto object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            <span className="text-primary">e</span>facture
          </h1>
          <p className="mt-1 text-sm text-muted">Scanner et gérer vos achats</p>
        </div>

        {(canInstall || isIos) && !isInstalled && (
          <div className="mb-4">
            <PwaInstallBanner canInstall={canInstall} isInstalled={isInstalled} isIos={isIos} onInstall={() => install()} />
          </div>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Connexion</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Numéro de téléphone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="90 12 34 56"
              hint="Togo (+228), 8 chiffres"
              required
            />
            <Input
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Se connecter
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Pas encore de compte ?{' '}
            <Link to="/auth/inscription" className="font-semibold text-primary">
              Créer un compte
            </Link>
          </p>
        </Card>


        <p className="mt-6 flex items-start justify-center gap-2 px-2 text-center text-xs leading-relaxed text-muted">
          <HardDrive size={14} className="mt-0.5 shrink-0" />
          Vos reçus et vos photos restent enregistrés sur cet appareil, sans compte en ligne.
        </p>
      </div>
    </div>
  );
}
