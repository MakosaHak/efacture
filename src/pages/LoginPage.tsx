import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { isSupabaseConfigured } from '../lib/supabase';

export default function LoginPage() {
  const { user, signInWithPhonePassword, signInDemo } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handlePasswordLogin = async (e: FormEvent) => {
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

  const handleDemo = async () => {
    setLoading(true);
    await signInDemo();
    navigate('/');
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#E2E8F0] via-[#DCE5EF] to-[#D5DFEC] px-5 pb-8 pt-4">
      <div className="mx-auto max-w-[420px]">
        <div className="mb-6 text-center">
          <img
            src="/icons/logo.png"
            alt="efacture"
            className="mx-auto mb-4 h-20 w-auto aspect-[612/408] object-contain"
          />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span className="text-[#2563EB]">e</span>
            <span className="text-[#0F172A]">facture</span>
          </h1>
          <p className="text-sm text-[#64748B]">Scanner &amp; Gérer Vos Achats au Togo</p>
        </div>

        <div className="mb-4">
          <PwaInstallBanner
            canInstall={canInstall}
            isInstalled={isInstalled}
            isIos={isIos}
            onInstall={() => install()}
          />
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl border border-[#1E3A8A]/30 bg-[#E2E8F0] p-3 text-xs text-[#0F172A]">
            Pas de Supabase ? Utilisez le <strong>mode démo</strong> ou inscrivez-vous (données sur cet appareil).
          </div>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-bold">Connexion</h2>

          <Button variant="demo" fullWidth className="mb-4" onClick={handleDemo} disabled={loading}>
            Mode démo (parcourir l&apos;app)
          </Button>

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <Input
              label="Numéro de téléphone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="90 12 34 56"
              required
            />
            <p className="-mt-2 text-[10px] text-[#94A3B8]">Togo (+228) — 8 chiffres</p>
            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[#64748B]">
            Pas encore de compte ?{' '}
            <Link to="/auth/inscription" className="font-semibold text-[#1E3A8A]">
              S&apos;inscrire
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
