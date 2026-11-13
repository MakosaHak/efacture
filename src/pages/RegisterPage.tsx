import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { DEFAULT_MARGIN } from '../lib/pricing';

export default function RegisterPage() {
  const { user, signUpWithPhonePassword } = useAuth();
  const navigate = useNavigate();
  const [nomCommerce, setNomCommerce] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quartier, setQuartier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handlePasswordRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithPhonePassword(phone, password, {
        nom_commerce: nomCommerce.trim(),
        telephone: phone,
        adresse: '',
        quartier: quartier.trim(),
        default_margin: DEFAULT_MARGIN,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#E2E8F0] via-[#DCE5EF] to-[#D5DFEC] px-5 py-8">
      <div className="mx-auto max-w-[420px]">
        <Card>
          <h2 className="mb-1 text-lg font-bold">Créer un compte</h2>
          <p className="mb-4 text-xs text-[#64748B]">
            Commerçants TPME — téléphone togolais et mot de passe, pas d&apos;email requis.
          </p>

          <form onSubmit={handlePasswordRegister} className="space-y-4">
            <Input
              label="Nom du commerce"
              value={nomCommerce}
              onChange={(e) => setNomCommerce(e.target.value)}
              placeholder="Ex: Épicerie Adawlato"
              required
            />
            <Input
              label="Numéro de téléphone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="90 12 34 56"
              required
            />
            <p className="-mt-2 text-[10px] text-[#94A3B8]">Togo (+228)</p>
            <Input
              label="Quartier / Marché (optionnel)"
              placeholder="Adawlato, Assivito…"
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
            />
            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[#64748B]">
            Déjà un compte ?{' '}
            <Link to="/auth/connexion" className="font-semibold text-[#1E3A8A]">
              Se connecter
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
