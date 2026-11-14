import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Notice } from '../components/ui/Feedback';
import { DEFAULT_MARGIN } from '../lib/pricing';

export default function RegisterPage() {
  const { user, loading: authLoading, signUpWithPhonePassword } = useAuth();
  const navigate = useNavigate();
  const [nomPersonne, setNomPersonne] = useState('');
  const [nomCommerce, setNomCommerce] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quartier, setQuartier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) return <Navigate to="/" replace />;

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithPhonePassword(phone, password, {
        nom_personne: nomPersonne.trim(),
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
    <div className="min-h-dvh bg-bg px-5 pb-8 pt-4">
      <div className="mx-auto max-w-[400px]">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/auth/connexion" aria-label="Retour" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface">
            <ChevronLeft size={22} />
          </Link>
          <h1 className="text-[17px] font-semibold text-ink">Créer un compte</h1>
        </div>

        <Card>
          <p className="mb-4 text-[13px] leading-relaxed text-muted">
            Un numéro de téléphone et un mot de passe suffisent. Le compte est enregistré sur cet appareil.
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Votre nom"
              value={nomPersonne}
              onChange={(e) => setNomPersonne(e.target.value)}
              placeholder="Ex. : Afi KOUMAKO"
              autoComplete="name"
              required
            />
            <Input
              label="Nom du commerce"
              value={nomCommerce}
              onChange={(e) => setNomCommerce(e.target.value)}
              placeholder="Ex. : Épicerie Adawlato"
              autoComplete="organization"
              required
            />
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
              label="Quartier ou marché (facultatif)"
              placeholder="Adawlato, Assivito…"
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
            />
            <Input
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              hint="6 caractères minimum"
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Créer mon compte
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Déjà un compte ?{' '}
            <Link to="/auth/connexion" className="font-semibold text-primary">
              Se connecter
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
